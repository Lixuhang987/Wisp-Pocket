import { expect, it } from "vitest";
import { once } from "node:events";
import { statSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import { FilePermissionPolicy } from "@handagent/core/adapters/filesystem/FilePermissionPolicy.ts";
import { loadModelSettings } from "@handagent/core/config/ModelSettings.ts";
import { AgentRuntime } from "@handagent/core/runtime/AgentRuntime.ts";
import { SettingsAPI } from "../../src/settings/SettingsAPI.ts";
import { SettingsBackedLLMClient } from "../../src/settings/SettingsBackedLLMClient.ts";
import { startServer } from "../../src/server/server.ts";
import { threadHarness, input } from "../support/threadHarness.ts";

it("saves backend configuration through HTTP for subsequent runtime use while preserving native preferences", async () => {
  const home = await mkdtemp(join(tmpdir(), "settings-api-"));
  const root = join(home, ".spotAgent");
  await mkdir(root);
  const settingsPath = join(root, "settings.json");
  const mcpPath = join(root, "mcp.json");
  const nativePath = join(root, "native-preferences.json");
  await writeFile(settingsPath, JSON.stringify({llm:{model:"before",summarizerModel:"summary-model",futureField:"preserve"},tools:{denylist:[]},other:{keep:true}}));
  await writeFile(nativePath, JSON.stringify({appearance:{theme:"dark"}}));
  const permissionPolicy = new FilePermissionPolicy({filePath:join(root,"permissions.json")});
  await permissionPolicy.remember({toolName:"file.write",arguments:{},toolCallId:"call"}, {decision:"allow",remember:"always"});
  const clients: string[] = [];
  const client = new SettingsBackedLLMClient({}, {
    loadModelSettings: () => loadModelSettings(home),
    readSettingsStamp: () => { const stamp=statSync(settingsPath); return `${stamp.mtimeMs}:${stamp.size}`; },
    createClient: settings => { clients.push(settings.model); return {complete:async () => ({message:{role:"assistant",content:settings.model}})}; },
  });
  const h = threadHarness(client, {createRuntime:(_id,tools) => new AgentRuntime(client,tools.registry)});
  const server = await startServer({commandRouter:h.router,eventPublisher:h.publisher,settingsAPI:new SettingsAPI({settingsPath,mcpPath,permissionPolicy}),port:0});
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/settings`;
  const request = (path:string,method="GET",body?:unknown) => fetch(base+path,{method,headers:{"Content-Type":"application/json"},...(body === undefined ? {} : {body:JSON.stringify(body)})});
  try {
    expect(await (await request("/model")).json()).toMatchObject({model:"before",summarizerModel:"summary-model",futureField:"preserve"});
    await client.complete([],[]);
    const results = await Promise.all([request("/model","PUT",{provider:"anthropic",model:"after",api:"chat",apiKey:"secret-value",baseUrl:"https://example.com"}),request("/tools","PUT",{name:"file.write",enabled:false}),writeFile(nativePath,JSON.stringify({appearance:{theme:"light"}}))]);
    expect(results.slice(0,2).every(response => response instanceof Response && response.ok)).toBe(true);
    expect(JSON.parse(await readFile(settingsPath,"utf8"))).toMatchObject({llm:{model:"after",summarizerModel:"summary-model",futureField:"preserve"},tools:{denylist:["file.write"]},other:{keep:true}});
    expect(JSON.parse(await readFile(nativePath,"utf8"))).toEqual({appearance:{theme:"light"}});
    expect(await (await request("/tools")).json()).toMatchObject({tools:[{name:"file.write",enabled:false}]});
    const start = await h.threads.create({commandId:"settings-run",petId:h.pet.id});
    await start.submit(input("使用已保存配置"));
    await new Promise<void>((resolve,reject)=>{const deadline=Date.now()+2000;const poll=()=>{if(start.status==="idle")resolve();else if(Date.now()>deadline)reject(new Error("Turn timeout"));else setTimeout(poll,10);};poll();});
    expect(clients).toEqual(["before","after"]);
    expect(JSON.stringify(start.snapshot())).toContain("after");
    const mcp = {version:1,servers:[{id:"local",title:"Local",transport:"stdio",command:"node",args:["server.js"],cwd:root,env:{TOKEN:"literal"},requestTimeoutMs:60000,elicitation:{autoAcceptEmptyForm:true}},{id:"remote",title:"Remote",transport:"streamableHttp",url:"https://example.com/mcp",headers:{Authorization:"Bearer ${PRIVATE_TOKEN}"}}]};
    expect(await (await request("/mcp","PUT",mcp)).json()).toEqual({saved:true});
    expect(await (await request("/mcp")).json()).toEqual(mcp);
    expect(JSON.parse(await readFile(mcpPath,"utf8"))).toEqual(mcp);
    const rules = await (await request("/permissions")).json();
    expect(rules.rules[0]).toMatchObject({toolName:"file.write",decision:"allow",createdAt:expect.any(String)});
    expect(await (await request("/permissions/file.write","DELETE")).json()).toEqual({rules:[]});
    expect(await permissionPolicy.check({toolName:"file.write",arguments:{},toolCallId:"call"})).toBe("ask");
    const invalid = await request("/model","PUT",{model:"",apiKey:"secret-value"});
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).not.toContain("secret-value");
    expect((await request("/mcp","PUT",{version:1,servers:[{id:"bad",transport:"stdio",command:""}]})).status).toBe(400);
    await rm(mcpPath);
    await mkdir(mcpPath);
    const failed = await request("/mcp","PUT",mcp);
    expect(failed.status).toBe(500);
    expect(await failed.text()).toContain("error");
    expect((await stat(settingsPath)).isFile()).toBe(true);
  } finally {
    server.close();
    await once(server,"close");
    await h.close();
    await rm(home,{recursive:true,force:true});
  }
});
