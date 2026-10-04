import { readFile, mkdir, writeFile, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { defaultModelSettings } from "@handagent/core/config/ModelSettings.ts";
import type { CodexCLI } from "../actions/CodexCLI.ts";
import { parseMCPConfig } from "@handagent/core/mcp/MCPConfig.ts";
import type { FilePermissionPolicy } from "@handagent/core/adapters/filesystem/FilePermissionPolicy.ts";
import { isNotFoundError } from "@handagent/core/utils/nodeErrors.ts";

const modelPatch = z.object({
  provider:z.enum(["openai-compatible","anthropic"]).optional(),
  model:z.string().trim().min(1).optional(),
  api:z.enum(["responses","chat","completion"]).optional(),
  baseUrl:z.string().trim().optional(),
  apiKey:z.string().optional(),
  summarizerModel:z.string().trim().min(1).optional(),
}).strict();

type Request = {
  method?:string; url?:string;
  on(event:"data",listener:(chunk:Buffer)=>void):void;
  on(event:"end",listener:()=>void):void;
  on(event:"error",listener:(error:Error)=>void):void;
};
type Response = {statusCode:number;setHeader(name:string,value:string):void;end(body?:string|Buffer):void};
class InvalidSettings extends Error {}

/** Serializes read-modify-write operations on backend configuration, independently of native preferences. */
export class SettingsAPI {
  private writing:Promise<void> = Promise.resolve();
  constructor(private readonly options:{settingsPath:string;mcpPath:string;permissionPolicy:FilePermissionPolicy;codexCLI:CodexCLI}) {}

  async handle(request:Request,response:Response):Promise<boolean> {
    const pathname = new URL(request.url??"/","http://127.0.0.1").pathname;
    if (!pathname.startsWith("/api/settings/")) return false;
    response.setHeader("Content-Type","application/json; charset=utf-8");
    response.setHeader("Cache-Control","no-store");
    response.setHeader("X-Content-Type-Options","nosniff");
    const path = pathname.slice("/api/settings".length);
    try {
      let result:unknown;
      if (path === "/model" && request.method === "GET") {
        await this.writing;
        const settings = await this.readObject(this.options.settingsPath);
        result = {...defaultModelSettings,...objectOrEmpty(settings.llm)};
      } else if (path === "/model" && request.method === "PUT") {
        const parsed = modelPatch.safeParse(await readJSON(request));
        if (!parsed.success || !Object.keys(parsed.data).length) throw new InvalidSettings("模型配置无效，请检查模型、服务和 API 字段。");
        result = await this.updateSettings(settings => {
          settings.llm = {...defaultModelSettings,...objectOrEmpty(settings.llm),...parsed.data};
          return settings.llm;
        });
      } else if (path === "/tools" && request.method === "GET") {
        await this.writing;
        result = {codex:await this.options.codexCLI.readiness()};
      } else if (path === "/mcp" && request.method === "GET") {
        await this.writing;
        const config = await this.readObject(this.options.mcpPath,{version:1,servers:[]});
        try { parseMCPConfig(config,{interpolateEnvironment:false}); } catch { throw new InvalidSettings("已保存的 MCP 配置无效，请检查配置文件。"); }
        result = config;
      } else if (path === "/mcp" && request.method === "PUT") {
        const config = await readJSON(request);
        try { parseMCPConfig(config,{interpolateEnvironment:false}); } catch { throw new InvalidSettings("MCP 配置无效，请检查服务字段。"); }
        const ids = (config as {servers:{id:string}[]}).servers.map(server => server.id);
        if (new Set(ids).size !== ids.length) throw new InvalidSettings("MCP 服务 ID 不能重复。");
        await this.enqueue(() => this.writeObject(this.options.mcpPath,config));
        result = {saved:true};
      } else if (path === "/permissions" && request.method === "GET") {
        result = {rules:this.options.permissionPolicy.listPersistedRules()};
      } else if (path.startsWith("/permissions/") && request.method === "DELETE") {
        let name:string;
        try { name = decodeURIComponent(path.slice("/permissions/".length)); } catch { throw new InvalidSettings("工具名称无效。"); }
        if (!name.trim()) throw new InvalidSettings("工具名称不能为空。");
        await this.options.permissionPolicy.revoke(name);
        result = {rules:this.options.permissionPolicy.listPersistedRules()};
      } else {
        response.statusCode = 404; response.end(JSON.stringify({error:"设置接口不存在。"})); return true;
      }
      response.statusCode = 200;
      response.end(JSON.stringify(result));
    } catch (error) {
      response.statusCode = error instanceof InvalidSettings ? 400 : 500;
      // Parser and filesystem messages may contain credentials; expose only controlled messages.
      response.end(JSON.stringify({error:error instanceof InvalidSettings ? error.message : "设置读写失败，请重试并检查存储位置。"}));
    }
    return true;
  }

  private updateSettings<T>(update:(settings:Record<string,unknown>)=>T):Promise<T> {
    return this.enqueue(async () => {
      const settings = await this.readObject(this.options.settingsPath);
      const result = update(settings);
      await this.writeObject(this.options.settingsPath,settings);
      return result;
    });
  }
  private enqueue<T>(operation:()=>Promise<T>):Promise<T> {
    const task = this.writing.then(operation);
    this.writing = task.then(()=>{},()=>{});
    return task;
  }
  private async readObject(path:string,fallback:Record<string,unknown>={}):Promise<Record<string,unknown>> {
    try {
      const value:unknown = JSON.parse(await readFile(path,"utf8"));
      if (!isObject(value)) throw new InvalidSettings("配置文件必须是 JSON 对象。");
      return value;
    } catch (error) {
      if (isNotFoundError(error)) return fallback;
      if (error instanceof SyntaxError) throw new InvalidSettings("配置文件不是有效 JSON。");
      throw error;
    }
  }
  private async writeObject(path:string,value:unknown):Promise<void> {
    await mkdir(dirname(path),{recursive:true});
    const temporary = `${path}.${crypto.randomUUID()}.tmp`;
    try { await writeFile(temporary,JSON.stringify(value,null,2),{encoding:"utf8",mode:0o600}); await rename(temporary,path); }
    finally { await rm(temporary,{force:true}); }
  }
}
function isObject(value:unknown):value is Record<string,unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function objectOrEmpty(value:unknown):Record<string,unknown> { return isObject(value)?value:{}; }
function readJSON(request:Request):Promise<unknown> {
  return new Promise((resolve,reject) => {
    const chunks:Buffer[] = []; let size = 0;
    request.on("data",chunk=>{size += chunk.length;if(size>1024*1024){reject(new InvalidSettings("配置内容超过大小限制。"));return;}chunks.push(chunk);});
    request.on("error",reject);
    request.on("end",()=>{try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new InvalidSettings("请求不是有效 JSON。")); }});
  });
}
