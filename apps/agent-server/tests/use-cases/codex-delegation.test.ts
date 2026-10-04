import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { AgentRuntime } from "@handagent/core/runtime/AgentRuntime.ts";
import { ThreadTools } from "@handagent/core/thread/ThreadTools.ts";
import { FilePermissionPolicy } from "@handagent/core/adapters/filesystem/FilePermissionPolicy.ts";
import type { AgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";
import { createCodexExecuteTool } from "../../src/actions/CodexExecuteTool.ts";
import { attachThreadSocketHandlers } from "../../src/server/server.ts";
import { threadHarness, input } from "../support/threadHarness.ts";
import { codexFixture } from "../support/codexFixture.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
const wait = (assertion: () => void | Promise<void>) => vi.waitFor(assertion, {timeout:5000,interval:10});
const meta = () => ({commandId:crypto.randomUUID(),timestamp:new Date().toISOString()});
async function setup(directory?: string, permission = false) {
  directory ??= await mkdtemp(join(tmpdir(), "codex-delegation-"));
  const root = directory;
  cleanups.push(() => rm(root, {recursive:true,force:true}));
  const cli = await codexFixture(root);
  const contexts: {messages:AgentMessage[];tools:any[]}[] = [];
  let selectedSession: string | undefined;
  const model = { complete: async (messages: AgentMessage[], tools:any[]) => {
    contexts.push({messages:structuredClone(messages),tools});
    if (messages.at(-1)?.role === "tool") return {message:{role:"assistant" as const,content:`结果：${messages.at(-1)!.content}`}};
    const latest = messages.findLast(message => message.role === "user")!;
    return {message:{role:"assistant" as const,content:""},toolCalls:[{id:crypto.randomUUID(),name:"codex.execute",arguments:{prompt:String(latest.content),...(selectedSession?{sessionId:selectedSession}:{})}}]};
  } };
  const policy = new FilePermissionPolicy({filePath:join(root,"permissions.json"),askResolver:request=>h.threads.get(request.threadId!)!.requests.askPermission(request)});
  const h = threadHarness(model, {
    createTools: id => new ThreadTools({ resolveTools: async () => [await createCodexExecuteTool({cli,store:h.store,threadId:id})] }),
    createRuntime: (_id, tools) => new AgentRuntime(model,tools.registry,permission?{permissionPolicy:policy}:{}),
  }, join(root,"threads.sqlite"));
  const {workspace} = await h.workspaces.create(join(root,"workspace"));
  class Socket extends EventEmitter { sent:any[]=[];send(raw:string){this.sent.push(JSON.parse(raw));} }
  const socket = new Socket();
  attachThreadSocketHandlers(socket as never,{commandRouter:h.router,eventPublisher:h.publisher,acceptServerRequests:true});
  const send=(command:unknown)=>socket.emit("message",Buffer.from(JSON.stringify(command)));
  const start=async()=>{const commandId=crypto.randomUUID();send({type:"thread.start",commandId,timestamp:new Date().toISOString(),payload:{workspaceId:workspace.id}});await wait(()=>expect(socket.sent.some(event=>event.type==="thread.started" && event.commandId===commandId)).toBe(true));return socket.sent.find(event=>event.type==="thread.started" && event.commandId===commandId).threadId as string;};
  const submit=(id:string,text:string)=>send({type:"op.submit",...meta(),threadId:id,payload:{op:input(text)}});
  const settle=async(id:string)=>wait(()=>expect(h.threads.get(id)!.status).toBe("idle"));
  let closed=false;
  const close=async()=>{if(closed)return;closed=true;socket.emit("close");await h.close();};cleanups.push(close);
  return {...h,cli,contexts,policy,workspace,socket,send,start,submit,settle,close,directory:root,select:(id?:string)=>{selectedSession=id;}};
}

it("首次委托真实写文件，独立保存会话，重建后明确 resume 并交付新增上下文", async () => {
  const h=await setup();const id=await h.start();
  h.submit(id,"背景：整理资料；约束：中文；验收：result.txt 写入摘要");
  await wait(()=>expect(h.store.listCodexSessions(id)).toHaveLength(1));
  expect(h.threads.get(id)!.status).toBe("running");
  await expect(readFile(join(h.workspace.rootPath,"result.txt"))).rejects.toThrow();
  await wait(async()=>expect(await readFile(join(h.workspace.rootPath,"result.txt"),"utf8")).toContain("背景：整理资料"));await h.settle(id);
  const [session]=h.store.listCodexSessions(id);expect(session.sessionId).toMatch(/^[a-f0-9-]{36}$/);
  expect(h.socket.sent.find(event=>event.type==="tool.finished").payload).toMatchObject({status:"completed",output:expect.stringContaining(session.sessionId)});
  const firstResult=JSON.parse(h.socket.sent.find(event=>event.type==="tool.finished").payload.output);
  expect(firstResult).toMatchObject({success:true,truncated:true,diagnostics:expect.arrayContaining(["fixture configuration warning","initial check failed; later corrected"])});
  expect(Buffer.byteLength(JSON.stringify(firstResult))).toBeLessThan(8192);
  await h.close();const rebuilt=await setup(h.directory);
  rebuilt.select(session.sessionId);rebuilt.send({type:"thread.resume",threadId:id,...meta()});
  await wait(()=>expect(rebuilt.threads.get(id)).toBeDefined());rebuilt.submit(id,"新增要求：补充结论");
  await wait(async()=>expect(await readFile(join(h.workspace.rootPath,"result.txt"),"utf8")).toContain("新增要求：补充结论"));await rebuilt.settle(id);
  const invocations=(await readFile(join(h.workspace.rootPath,"invocations.jsonl"),"utf8")).trim().split("\n").map(line=>JSON.parse(line));
  expect(invocations).toHaveLength(2);expect(invocations[1]).toMatchObject({id:session.sessionId,cwd:h.workspace.rootPath,prompt:"新增要求：补充结论"});
  expect(invocations[1].args).toContain("resume");expect(rebuilt.contexts[0].tools.find(tool=>tool.name==="codex.execute").description).toContain(session.sessionId);
  expect((await rebuilt.persistence.getThread(id))!.messages.some(message=>message.role==="tool" && message.content.includes("补充结论"))).toBe(true);
  rebuilt.select();rebuilt.submit(id,"独立任务：另起会话");
  await wait(()=>expect(rebuilt.store.listCodexSessions(id)).toHaveLength(2));await rebuilt.settle(id);
  expect(rebuilt.store.listCodexSessions(id).map(session=>session.sessionId)).toContain(session.sessionId);
});

it("公开 Permission 回执决定是否启动，永久授权可接续本 Thread，会话不跨 Thread", async () => {
  const h=await setup(undefined,true);const id=await h.start();h.submit(id,"第一次");
  const request=async()=>{await wait(()=>expect(h.threads.get(id)!.requests.snapshot()).toHaveLength(1));return h.threads.get(id)!.requests.snapshot()[0];};
  const respond=(req:any,decision:"allow"|"deny",remember:"once"|"always")=>h.send({type:"permission.answered",requestId:req.requestId,timestamp:new Date().toISOString(),payload:{decision,scope:remember}});
  respond(await request(),"deny","once");await h.settle(id);
  await expect(readFile(join(h.workspace.rootPath,"invocations.jsonl"))).rejects.toThrow();
  h.submit(id,"第二次");const req=await request();respond(req,"allow","always");respond(req,"allow","once");
  await wait(async()=>expect(await readFile(join(h.workspace.rootPath,"result.txt"),"utf8")).toBe("第二次"));await h.settle(id);
  const session=h.store.listCodexSessions(id)[0];h.select(session.sessionId);h.submit(id,"接续");
  await wait(async()=>expect(await readFile(join(h.workspace.rootPath,"result.txt"),"utf8")).toContain("接续"));await h.settle(id);
  expect(h.policy.listPersistedRules()).toMatchObject([{toolName:"codex.execute",decision:"allow"}]);
  const other=await h.start();h.submit(other,"跨 Thread 误选");await wait(()=>expect(h.socket.sent.some(event=>event.threadId===other && event.type==="tool.finished" && event.payload.status==="failed")).toBe(true));await h.settle(other);
  expect((await readFile(join(h.workspace.rootPath,"invocations.jsonl"),"utf8")).trim().split("\n")).toHaveLength(2);
  expect(h.store.listCodexSessions(other)).toEqual([]);
});

it("受限执行回传错误和已知会话，补充输入后由模型明确接续成功", async () => {
  const h=await setup();const id=await h.start();
  await rm(join(h.directory,"codex-fixture.mjs"));h.submit(id,"首次启动失败");
  await wait(()=>expect(h.socket.sent.some(event=>event.type==="tool.finished" && event.payload.status==="failed")).toBe(true));await h.settle(id);
  expect(h.store.listCodexSessions(id)).toEqual([]);
  expect(JSON.stringify(h.contexts.at(-1)!.messages)).toContain("Codex 退出码");
  await codexFixture(h.directory);h.submit(id,"FAIL");
  await wait(()=>expect(h.socket.sent.some(event=>event.type==="tool.finished" && event.payload.status==="failed")).toBe(true));await h.settle(id);
  await wait(()=>expect(h.store.listCodexSessions(id)).toHaveLength(1));await h.settle(id);
  const session=h.store.listCodexSessions(id)[0];
  const result=JSON.parse(h.socket.sent.filter(event=>event.type==="tool.finished").at(-1).payload.output);
  expect(result).toMatchObject({success:false,sessionId:session.sessionId,exitCode:1,truncated:true,error:expect.stringContaining("approval required")});
  expect(JSON.stringify(h.contexts.at(-1)!.messages)).toContain("approval required");
  h.select(session.sessionId);h.submit(id,"TOO_LARGE");
  await wait(()=>expect(h.socket.sent.filter(event=>event.type==="tool.finished")).toHaveLength(3));await h.settle(id);
  expect(JSON.parse(h.socket.sent.filter(event=>event.type==="tool.finished").at(-1).payload.output)).toMatchObject({success:false,sessionId:session.sessionId,truncated:true,error:expect.stringContaining("单行输出超过")});
  h.submit(id,"已调整约束，继续完成");
  await wait(async()=>expect(await readFile(join(h.workspace.rootPath,"result.txt"),"utf8")).toBe("已调整约束，继续完成"));await h.settle(id);
  expect(h.store.listCodexSessions(id)).toHaveLength(1);
  expect(h.socket.sent.filter(event=>event.type==="tool.finished").at(-1).payload.status).toBe("completed");
});
