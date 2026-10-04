// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/activity-window/App.tsx";
import { installPetBridge, petFixture } from "./petBridgeFixture.ts";
import { PetThreadController } from "../../src/activity-window/petThreadController.ts";

class Socket {
  static latest: Socket;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: Array<Record<string, any>> = [];
  constructor(_url: string) { Socket.latest = this; }
  open() { this.readyState = 1; this.onopen?.(); }
  send(raw: string) { this.sent.push(JSON.parse(raw)); }
  receive(message: object) { this.onmessage?.({ data: JSON.stringify(message) }); }
  close() { this.readyState = 3; }
}

let controller: PetThreadController;
let sequence = 0;
const note = (type: string, extra: any = {}) => ({ type, notificationId: String(++sequence), timestamp: "2026-09-13T01:00:00.000Z", ...extra, ...(extra.payload ? {payload: {workspaceId:"workspace-default",rootPath:"/tmp",...extra.payload}} : {}) });
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.handAgentPet = {getPathForFile: file=>`/tmp/${file.name}`,chooseFiles:async()=>[],setReceiving:vi.fn(),showPet:async()=>{},hidePet:vi.fn(),onReveal:()=>()=>{}, setLayout: vi.fn(), setInteractiveRegions: vi.fn(), beginMove: vi.fn(), move: vi.fn(), endMove: vi.fn() };
  installPetBridge([petFixture()]);
  controller = new PetThreadController({ petId:"pet-default", url: "ws://local/api/thread", WebSocketImpl: Socket });
});
afterEach(() => { cleanup(); controller.disconnect(); delete window.handAgentSettings; vi.restoreAllMocks(); });

async function ackLast() {
  const sent=Socket.latest.sent.at(-1)!;
  await act(async()=>Socket.latest.receive(note("user.message.recorded",{threadId:sent.threadId,payload:{messageId:sent.payload.op.opId,text:sent.payload.op.payload.items[0].text ?? sent.payload.op.payload.items[0].name ?? "",items:sent.payload.op.payload.items}})));
}

function mount() {
  render(<App controller={controller} />);
  act(() => Socket.latest.open());
}

function startThread(text = "第一行\n第二行\n第三行\n第四行\n第五行全文") {
  act(() => {
    Socket.latest.receive(note("thread.started", { threadId: "a", payload: { preview: "资料" } }));
    Socket.latest.receive(note("user.message.recorded", { threadId: "a", payload: { messageId: "input", text: "我的资料", items: [{ type: "text", id: "item", text: "我的资料" }] } }));
    Socket.latest.receive(note("assistant.delta", { threadId: "a", turnId: "turn", itemId: "answer", payload: { text, suggestedReplies: ["请整理这份资料"], awaitingReply: true } }));
    controller.selectThread("a"); controller.revealBubble();
  });
}

describe("桌宠的轻量交互", () => {
  it.each([false, true])("服务端保存失败可见且遵守主动隐藏，已创建 Thread=%s", async (started) => {
    mount();
    fireEvent.drop(screen.getByRole("button", { name: /月见八千代/ }), {
      dataTransfer: { types: ["text/plain"], files: [], getData: () => "交付的内容" },
    });
    await waitFor(() => expect(Socket.latest.sent.at(-1)?.type).toBe("thread.start"));
    act(() => {
      if (started) Socket.latest.receive(note("thread.started", { commandId: Socket.latest.sent.at(-1)!.commandId, threadId: "a", payload: { preview: "资料" } }));
      Socket.latest.receive(note("thread.error", { ...(started ? { threadId: "a" } : {}), payload: { message: "保存输入失败：磁盘已满" } }));
    });
    expect(screen.getByRole("alert").textContent).toContain("磁盘已满");
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    act(() => Socket.latest.receive(note("thread.error", { ...(started ? { threadId: "a" } : {}), payload: { message: "保存输入失败：磁盘已满" } })));
    expect(screen.queryByTestId("pet-conversation")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    expect(screen.getByRole("alert").textContent).toContain("磁盘已满");
    act(() => {
      if (!started) Socket.latest.receive(note("thread.started", { threadId: "a", payload: { preview: "重试资料" } }));
      Socket.latest.receive(note("turn.started", { threadId: "a", turnId: "retry", payload: {} }));
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("点击角色唤出空回复框并聚焦，隐藏后再次点击保留草稿，发送前不创建 Thread", () => {
    mount();
    const pet = screen.getByRole("button", { name: /月见八千代/ });
    fireEvent.click(pet);
    const input = screen.getByRole("textbox", { name: "回复当前对话" }) as HTMLTextAreaElement;
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole("log")).toBeNull();
    expect(screen.queryByTestId("pet-latest")).toBeNull();
    fireEvent.change(input, { target: { value: "先记下这个想法" } });
    fireEvent.click(pet);
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(pet);
    const restored = screen.getByRole("textbox", { name: "回复当前对话" }) as HTMLTextAreaElement;
    expect(restored.value).toBe("先记下这个想法");
    expect(document.activeElement).toBe(restored);
    expect(Socket.latest.sent.filter((message) => message.type === "thread.start")).toHaveLength(0);

    cleanup();
    controller = new PetThreadController({ petId: "pet-default", url: "ws://local/api/thread", WebSocketImpl: Socket });
    mount();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("先记下这个想法");
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    cleanup();
    controller = new PetThreadController({ petId: "pet-default", url: "ws://local/api/thread", WebSocketImpl: Socket });
    mount();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("先记下这个想法");

  });

  it("首条文字只创建一个 Thread，持久接收前保留草稿，确认不覆盖新编辑，后续回复追加同一 Thread", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    const input = screen.getByRole("textbox", { name: "回复当前对话" }) as HTMLTextAreaElement;
    window.handAgentPet!.chooseFiles = async () => ["/tmp/reading.pdf"];
    const beforeFiles = Socket.latest.sent.length;
    fireEvent.click(screen.getByRole("button", { name: "添加文件" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "移除 reading.pdf" })).toBeTruthy());
    expect(Socket.latest.sent).toHaveLength(beforeFiles);
    fireEvent.change(input, { target: { value: "帮我安排今天的阅读" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    const starts = Socket.latest.sent.filter((message) => message.type === "thread.start");
    expect(starts).toHaveLength(1);
    expect(starts[0]?.payload).toEqual({workspaceId:"workspace-default"});
    expect(input.value).toBe("帮我安排今天的阅读");
    act(() => Socket.latest.receive(note("thread.started", { commandId: starts[0]!.commandId, threadId: "first", payload: { preview: "阅读" } })));
    expect(window.handAgentSettings!.assignPet).toHaveBeenLastCalledWith({petId:"pet-default",workspaceId:"workspace-default",threadId:"first",activate:false,expected:{workspaceId:"workspace-default",threadId:null}});
    const submitted = Socket.latest.sent.at(-1)!;
    expect(submitted).toMatchObject({ type: "op.submit", threadId: "first", payload: { op: { opId: starts[0]!.commandId } } });
    expect(submitted.payload.op.payload.items).toEqual([
      { type: "text", id: expect.any(String), text: "帮我安排今天的阅读" },
      { type: "file_reference", id: expect.any(String), name: "reading.pdf", path: "/tmp/reading.pdf" },
      {type:"skill",id:expect.any(String),actionId:"initial-role",title:"角色提示",prompt:"Help"},
    ]);
    act(() => Socket.latest.receive(note("thread.snapshot", { threadId: "first", payload: { status: "idle", messages: [] } })));
    fireEvent.mouseEnter(document.querySelector(".pet-conversation")!);
    expect(document.querySelector('[data-author="user"] p')?.textContent).toBe("帮我安排今天的阅读");
    expect(document.querySelector('[data-attachment-type="role_prompt"]')?.getAttribute("title")).toBe("Help");
    expect(input.value).toBe("帮我安排今天的阅读");
    fireEvent.change(input, { target: { value: "还有另一条补充" } });
    window.handAgentPet!.chooseFiles = async () => ["/tmp/later.txt"];
    fireEvent.click(screen.getByRole("button", { name: "添加文件" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "移除 later.txt" })).toBeTruthy());
    await act(async () => Socket.latest.receive(note("user.message.recorded", {
      threadId: "first", payload: { messageId: submitted.payload.op.opId, text: "帮我安排今天的阅读", items: submitted.payload.op.payload.items, pending: true },
    })));
    expect(input.value).toBe("还有另一条补充");
    expect(controller.getSnapshot().files.map(file => file.path)).toEqual(["/tmp/later.txt"]);
    await act(async () => {
      Socket.latest.receive(note("turn.started", { threadId: "first", turnId: submitted.payload.op.opId, payload: {} }));
      Socket.latest.receive(note("thread.snapshot", { threadId: "first", payload: {
        workspaceId: "workspace-default", status: "running", messages: [{
          id: submitted.payload.op.opId, role: "user", text: "帮我安排今天的阅读", inputItems: submitted.payload.op.payload.items,
          status: "completed", createdAt: "2026", updatedAt: "2026",
        }],
      } }));
    });
    fireEvent.mouseEnter(document.querySelector(".pet-conversation")!);
    expect(document.querySelectorAll('[data-author="user"]')).toHaveLength(1);
    expect(controller.store.getState().threadsById.first.messages.filter(item => item.type === "user_message" && item.pending)).toHaveLength(0);
    expect(document.querySelectorAll('[data-attachment-type="role_prompt"]')).toHaveLength(1);
    expect(document.querySelector('[data-author="user"] p')?.textContent).toBe("帮我安排今天的阅读");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(Socket.latest.sent.at(-1)).toMatchObject({ type: "op.submit", threadId: "first" });
    expect(Socket.latest.sent.at(-1)?.payload.op.payload.items).toEqual([
      { type: "text", id: expect.any(String), text: "还有另一条补充" },
      { type: "file_reference", id: expect.any(String), path: "/tmp/later.txt", name: "later.txt" },
    ]);
    expect(input.value).toBe("还有另一条补充");
    await ackLast();
    act(() => Socket.latest.receive(note("turn.completed", { threadId: "first", turnId: submitted.payload.op.opId, payload: { status: "completed" } })));
    expect(input.value).toBe("");
    expect(controller.getSnapshot().files).toEqual([]);
    expect(Socket.latest.sent.filter((message) => message.type === "thread.start")).toHaveLength(1);
    window.handAgentPet!.chooseFiles = async () => ["/tmp/only.txt"];
    fireEvent.click(screen.getByRole("button", { name: "添加文件" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "移除 only.txt" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "发送回复" }));
    expect(Socket.latest.sent.at(-1)?.payload.op.payload.items).toEqual([
      { type: "file_reference", id: expect.any(String), path: "/tmp/only.txt", name: "only.txt" },
    ]);
    await ackLast();
    fireEvent.click(screen.getByRole("button", { name: "新建对话" }));
    expect(controller.getSnapshot().threadId).toBeNull();
    expect(document.activeElement).toBe(input);
    expect(Socket.latest.sent.filter((message) => message.type === "thread.start")).toHaveLength(1);
  });

  it.each([false, true])("首次文字提交失败保留可重试草稿，已创建 Thread=%s", async (created) => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    let input = screen.getByRole("textbox", { name: "回复当前对话" }) as HTMLTextAreaElement;
    await act(async () => { await controller.newTopic(); await controller.newTopic(); });
    window.handAgentPet!.chooseFiles = async () => ["/tmp/retry.pdf"];
    fireEvent.click(screen.getByRole("button", { name: "添加文件" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "移除 retry.pdf" })).toBeTruthy());
    fireEvent.change(input, { target: { value: "不能丢掉的首条输入" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const start = Socket.latest.sent.at(-1)!;
    await act(async () => {
      if (created) {
        Socket.latest.receive(note("thread.started", { commandId: start.commandId, threadId: "first", payload: { preview: "首条" } }));
        Socket.latest.receive(note("thread.snapshot", { threadId: "first", payload: { messages: [], status: "idle" } }));
      }
      Socket.latest.receive(note("thread.error", {
        ...(created ? { threadId: "first" } : { commandId: start.commandId }), payload: { message: "保存输入失败" },
      }));
    });
    expect(input.value).toBe("不能丢掉的首条输入");
    expect(screen.getByRole("alert").textContent).toContain("保存输入失败");
    expect((screen.getByRole("button", { name: "发送回复" }) as HTMLButtonElement).disabled).toBe(false);

    // 接收结果不确定后重建 renderer，重试仍沿用原提交身份。
    cleanup();
    controller = new PetThreadController({ petId: "pet-default", url: "ws://local/api/thread", WebSocketImpl: Socket });
    mount();
    act(() => Socket.latest.receive(note("thread.listed", { payload: { threads: created ? [{
      id: "first", workspaceId: "workspace-default", rootPath: "/tmp", status: "idle",
      preview: "首条", messageCount: 0, createdAt: "2026", updatedAt: "2026",
    }] : [] } })));
    input = screen.getByRole("textbox", { name: "回复当前对话" }) as HTMLTextAreaElement;
    expect(screen.getByRole("button", { name: "移除 retry.pdf" })).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(Socket.latest.sent.at(-1)?.type).toBe(created ? "op.submit" : "thread.start");
    expect(created ? Socket.latest.sent.at(-1)?.payload.op.opId : Socket.latest.sent.at(-1)?.commandId).toBe(start.commandId);
    expect(input.value).toBe("不能丢掉的首条输入");
    expect((screen.getByRole("button", { name: "发送回复" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      if (!created) {
        Socket.latest.receive(note("thread.started", {
          commandId: Socket.latest.sent.at(-1)!.commandId, threadId: "first", payload: { preview: "首条" },
        }));
        Socket.latest.receive(note("thread.snapshot", { threadId: "first", payload: { messages: [], status: "idle" } }));
      }
      Socket.latest.receive(note("thread.error", { threadId: "first", payload: { message: "保存输入再次失败" } }));
    });
    expect(input.value).toBe("不能丢掉的首条输入");
    expect(screen.getByRole("alert").textContent).toContain("保存输入再次失败");
    fireEvent.keyDown(input, { key: "Enter" });
    const accepted = Socket.latest.sent.at(-1)!;
    expect(accepted).toMatchObject({ type: "op.submit", threadId: "first" });
    expect(accepted.payload.op.payload.items.filter((item:any)=>item.type==="skill")).toEqual([{type:"skill",id:expect.any(String),actionId:"initial-role",title:"角色提示",prompt:"Help"}]);
    expect(input.value).toBe("不能丢掉的首条输入");
    await act(async () => Socket.latest.receive(note("user.message.recorded", {
      threadId: "first", payload: { messageId: accepted.payload.op.opId, text: "不能丢掉的首条输入", items: accepted.payload.op.payload.items },
    })));
    expect(input.value).toBe("");
    expect(controller.getSnapshot().files).toEqual([]);
    expect(Socket.latest.sent.filter((message) => message.type === "thread.start")).toHaveLength(created ? 0 : 1);
  });

  it.each([false, true])("首次发送期间隐藏，后续确认或错误保持隐藏并正确保留草稿，接收成功=%s", async (accepted) => {
    mount();
    const pet = screen.getByRole("button", { name: /月见八千代/ });
    fireEvent.click(pet);
    const input = screen.getByRole("textbox", { name: "回复当前对话" });
    fireEvent.change(input, { target: { value: "暂时收起这条输入" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const start = Socket.latest.sent.at(-1)!;
    fireEvent.click(pet);
    await act(async () => { await window.handAgentSettings!.hidePet("pet-default"); });
    await act(async () => {
      Socket.latest.receive(note("thread.started", { commandId: start.commandId, threadId: "first", payload: { preview: "首条" } }));
      Socket.latest.receive(accepted
        ? note("user.message.recorded", { threadId: "first", payload: { messageId: start.commandId, text: "暂时收起这条输入" } })
        : note("thread.error", { threadId: "first", payload: { message: "保存输入失败" } }));
    });
    expect(screen.queryByTestId("pet-conversation")).toBeNull();
    expect(controller.getSnapshot().pet).toMatchObject({threadId:"first",visible:false});
    fireEvent.click(pet);
    expect((screen.getByRole("textbox", { name: "回复当前对话" }) as HTMLTextAreaElement).value).toBe(accepted ? "" : "暂时收起这条输入");
  });

  it("启动只显示角色；最新消息、建议和回复常驻，移出即收回常态并保留输入焦点", () => {
    mount();
    expect(screen.getByRole("button", { name: /月见八千代/ })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    startThread();
    const bubble = screen.getByTestId("pet-conversation");
    const input = screen.getByRole("textbox", { name: "回复当前对话" });
    expect(screen.getByRole("button", { name: "请整理这份资料" })).toBeTruthy();
    expect(bubble.querySelector(".pet-reply")!.contains(screen.getByRole("button", { name: "添加文件" }))).toBe(true);
    expect(screen.queryByRole("log")).toBeNull();
    expect(screen.getByTestId("pet-latest").className).toContain("pet-latest");
    expect(vi.mocked(window.handAgentPet!.setLayout).mock.lastCall?.[0]).toBe("compact");
    fireEvent.mouseEnter(bubble);
    expect(screen.getByTestId("pet-latest").textContent).toContain("第五行全文");
    expect(screen.getByRole("log").querySelector('[data-author="user"]')?.textContent).toContain("我的资料");
    expect(screen.getByRole("log").contains(input)).toBe(false);
    act(() => input.focus());
    fireEvent.mouseLeave(bubble);
    expect(screen.queryByRole("log")).toBeNull();
    expect(document.activeElement).toBe(input);
    act(() => input.blur());
    expect(screen.getByRole("textbox", { name: "回复当前对话" })).toBe(input);
    expect(screen.getByRole("button", { name: "请整理这份资料" })).toBeTruthy();
    expect(vi.mocked(window.handAgentPet!.setLayout).mock.lastCall?.[0]).toBe("compact");
  });

  it("常态即可点击当前建议和发送自由回复，不需要先展开历史", async () => {
    mount(); startThread("看看这些安排。");
    fireEvent.click(screen.getByRole("button", { name: "请整理这份资料" }));
    expect(Socket.latest.sent.at(-1)).toMatchObject({
      type: "op.submit", threadId: "a", payload: { op: { payload: { items: [{ type: "text", text: "请整理这份资料" }] } } },
    });
    await ackLast();
    fireEvent.change(screen.getByRole("textbox", { name: "回复当前对话" }), { target: { value: "先只看第一项" } });
    fireEvent.click(screen.getByRole("button", { name: "发送回复" }));
    expect(Socket.latest.sent.at(-1)).toMatchObject({
      type: "op.submit", threadId: "a", payload: { op: { payload: { items: [{ type: "text", text: "先只看第一项" }] } } },
    });
  });

  it("右键菜单进入伙伴、对话、隐藏和大小调节，刷新命中并恢复偏好，回复节点与草稿保持不变", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (!this.classList.contains("pet-character")) return new DOMRect();
      const width = Number.parseFloat(this.style.width);
      const height = Number.parseFloat(this.style.height);
      return new DOMRect(200 - width, 640 - height, width, height);
    });
    mount(); startThread("同一段回复");
    const pet = screen.getByRole("button", { name: /月见八千代/ });
    const latest = screen.getByTestId("pet-latest");
    const input = screen.getByRole("textbox", { name: "回复当前对话" });
    fireEvent.change(input, { target: { value: "保留这份草稿" } });
    expect(pet.style.width).toBe("128px");
    fireEvent.contextMenu(pet);
    expect(screen.getByRole("menu", { name: "桌宠菜单" })).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "对话" }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.contextMenu(pet);
    fireEvent.click(screen.getByRole("menuitem", { name: "对话" }));
    expect(screen.getByRole("region", { name: "工作区对话" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    fireEvent.contextMenu(pet);
    fireEvent.click(screen.getByRole("menuitem", { name: "伙伴" }));
    expect(screen.getByRole("region", { name: "伙伴管理" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "添加桌宠" }));
    fireEvent.change(screen.getByLabelText("名称"), {target:{value:"保存中的伙伴"}});
    fireEvent.change(screen.getByLabelText("描述"), {target:{value:"超时仍保留"}});
    const save = vi.mocked(window.handAgentSettings!.savePet);
    save.mockRejectedValueOnce(new Error("保存回执超时，请重试"));
    fireEvent.click(screen.getByRole("button", {name:"保存伙伴"}));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("超时");
    expect(screen.getByLabelText<HTMLInputElement>("名称").value).toBe("保存中的伙伴");
    expect(screen.getByLabelText<HTMLInputElement>("描述").value).toBe("超时仍保留");
    save.mockRejectedValueOnce(new Error("请重试"));
    fireEvent.click(screen.getByRole("button", {name:"保存伙伴"}));
    await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]?.[1]).toBe(save.mock.calls[0]?.[1]);
    await act(async()=>{});
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    fireEvent.contextMenu(pet);
    fireEvent.click(screen.getByRole("menuitem", { name: "隐藏" }));
    expect(window.handAgentPet!.hidePet).toHaveBeenCalledOnce();
    fireEvent.contextMenu(pet);
    fireEvent.click(screen.getByRole("menuitem", { name: "调整大小" }));
    const slider = screen.getByRole("slider", { name: "桌宠大小" });
    fireEvent.change(slider, { target: { value: "150" } });
    expect(pet.style.width).toBe("192px");
    expect(Number.parseFloat(pet.style.height)).toBe(208);
    expect(screen.getByTestId("pet-latest")).toBe(latest);
    expect(screen.getByRole("textbox", { name: "回复当前对话" })).toBe(input);
    expect((input as HTMLTextAreaElement).value).toBe("保留这份草稿");
    expect(window.handAgentPet?.setInteractiveRegions).toHaveBeenLastCalledWith(expect.arrayContaining([
      { x: 8, y: 432, width: 192, height: 208 },
    ]));
    cleanup(); mount();
    const restoredPet = screen.getByRole("button", { name: /月见八千代/ });
    expect(restoredPet.style.width).toBe("192px");
    fireEvent.contextMenu(restoredPet);
    fireEvent.click(screen.getByRole("menuitem", { name: "调整大小" }));
    expect((screen.getByRole("slider", { name: "桌宠大小" }) as HTMLInputElement).value).toBe("150");
    fireEvent.click(screen.getByRole("button", { name: "恢复默认大小" }));
    expect(restoredPet.style.width).toBe("128px");
  });

  it("悬停时最新回复和全部建议进入历史的同一滚动区，回复框保持固定节点", async () => {
    mount(); startThread("前一条桌宠回复");
    act(() => Socket.latest.receive(note("thread.snapshot", { threadId: "a", payload: {
      status: "idle",
      messages: [
        { id: "input", role: "user", text: "/tmp/private/资料.pdf", inputItems: [
          { type: "text", id: "text", text: "我的资料 /tmp/file_name.md **原文**" },
          { type: "file_reference", id: "file", path: "/tmp/private/资料.pdf", name: "资料.pdf" },
        ], status: "completed", createdAt: "2026", updatedAt: "2026" },
        { id: "tool-only-assistant", role: "assistant", text: "", status: "completed", createdAt: "2026", updatedAt: "2026" },
        { id: "whitespace-assistant", role: "assistant", text: " \n ", status: "completed", createdAt: "2026", updatedAt: "2026" },
        { id: "read-tool", role: "tool", text: "工具读取结果", toolCall: { name: "file.read" }, status: "completed", createdAt: "2026", updatedAt: "2026" },
        { id: "answer", role: "assistant", text: "# 前一条桌宠回复", status: "completed", createdAt: "2026", updatedAt: "2026" },
      ],
    } })));
    expect(controller.store.getState().threadsById.a.workspaceId).toBe("workspace-default");
    const markdown = [
      "最新的回复留在角色头上", "", "**重点**与~~删除~~，`行内代码`", "",
      "- 阅读正文", "- [x] 已完成", "", "> 引用内容", "",
      "| 项目 | 结果 |", "| --- | --- |", "| 解析 | 成功 |", "",
      "[查看网页](https://example.com/docs)", "[本地标签](file:///tmp/private)",
      "[相对标签](./notes.md)", "[脚本标签](javascript:alert%281%29)",
      "![图示](https://example.com/tracking.png)", "",
      '<script>alert("raw")</script>', "", "```ts", "const value = 1;",
    ].join("\n");
    act(() => Socket.latest.receive(note("assistant.delta", {
      threadId: "a", turnId: "second-turn", itemId: "latest-answer", payload: { text: "  " },
    })));
    expect(screen.getByTestId("pet-latest").textContent).toContain("前一条桌宠回复");
    act(() => Socket.latest.receive(note("assistant.delta", {
      threadId: "a", turnId: "second-turn", itemId: "latest-answer",
      payload: { text: markdown, suggestedReplies: ["继续阅读"], awaitingReply: true },
    })));
    const input = screen.getByRole("textbox", { name: "回复当前对话" });
    fireEvent.change(input, { target: { value: "保留 Markdown 草稿" } });
    const latest = screen.getByTestId("pet-latest");
    expect(controller.store.getState().threadsById.a.messages.find(message => message.id === "latest-answer")).toMatchObject({ text: `  ${markdown}` });
    expect(latest.querySelector("strong")?.textContent).toBe("重点");
    expect(latest.querySelector("del")?.textContent).toBe("删除");
    expect(latest.querySelector("li")?.textContent).toBe("阅读正文");
    expect(latest.querySelector('input[type="checkbox"]')?.hasAttribute("disabled")).toBe(true);
    expect(latest.querySelector("blockquote")?.textContent).toContain("引用内容");
    expect(latest.querySelector("table")?.textContent).toContain("成功");
    const link = screen.getByRole("link", { name: "查看网页" });
    expect(link.getAttribute("href")).toBe("https://example.com/docs");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(latest.querySelector("a[href^='file:'], a[href^='javascript:'], img, script")).toBeNull();
    expect(screen.queryByRole("link", { name: "相对标签" })).toBeNull();
    expect(latest.textContent).toContain("图示");
    expect(latest.textContent).toContain('<script>alert("raw")</script>');
    act(() => Socket.latest.receive(note("assistant.delta", {
      threadId: "a", turnId: "second-turn", itemId: "latest-answer", payload: { text: "\nconst next = 2;\n```" },
    })));
    expect(latest.querySelector("pre code")?.textContent).toBe("const value = 1;\nconst next = 2;\n");
    fireEvent.mouseEnter(screen.getByTestId("pet-conversation"));
    expect(screen.getAllByText("最新的回复留在角色头上")).toHaveLength(1);
    const history = screen.getByRole("log");
    expect(history.contains(screen.getByTestId("pet-latest"))).toBe(true);
    expect(history.contains(screen.getByRole("button", { name: "继续阅读" }))).toBe(true);
    expect(history.contains(input)).toBe(false);
    expect(screen.getByTestId("pet-conversation").querySelectorAll("[data-pet-scroll-viewport]")).toHaveLength(1);
    expect(history.querySelector('[data-author="assistant"] h1')?.textContent).toBe("前一条桌宠回复");
    expect(Array.from(history.querySelectorAll('[data-author="assistant"]')).map(node => !!node.textContent?.trim())).toEqual([true, true]);
    expect(history.textContent).not.toContain("工具读取结果");
    expect(history.querySelector('[data-author="user"]')?.textContent).toContain("我的资料 /tmp/file_name.md **原文**");
    expect(history.querySelectorAll(".pet-attachment")).toHaveLength(1);
    expect(history.querySelector(".pet-attachment")?.textContent).toBe("资料.pdf");
    expect(history.innerHTML).not.toContain("/tmp/private");
    fireEvent.click(screen.getByRole("button", { name: "继续阅读" }));
    expect(Socket.latest.sent.at(-1)).toMatchObject({
      type: "op.submit", threadId: "a", payload: { op: { payload: { items: [{ type: "text", text: "继续阅读" }] } } },
    });
    fireEvent.mouseLeave(screen.getByTestId("pet-conversation"));
    expect(screen.getByRole("textbox", { name: "回复当前对话" })).toBe(input);
    expect(screen.getByTestId("pet-latest").querySelector("pre code")?.textContent).toContain("const next = 2;");
    expect((input as HTMLTextAreaElement).value).toBe("保留 Markdown 草稿");
    await ackLast();

    act(() => Socket.latest.receive(note("assistant.delta", {
      threadId: "a", turnId: "suggestions-only", itemId: "suggestions-only", payload: { text: "", awaitingReply: true },
    })));
    expect(screen.getByTestId("pet-latest")).toBeTruthy();
    act(() => Socket.latest.receive(note("assistant.delta", {
      threadId: "a", turnId: "suggestions-only", itemId: "suggestions-only", payload: { text: "", suggestedReplies: ["只按建议继续"] },
    })));
    expect(screen.getByRole("button", { name: "只按建议继续" })).toBeTruthy();
    expect(screen.queryByTestId("pet-latest")).toBeNull();
    act(() => Socket.latest.receive(note("thread.snapshot", { threadId: "a", payload: { status: "idle", messages: [
      { id: "file-only", role: "user", text: "仅附件.pdf", pending: true, inputItems: [
        { type: "file_reference", id: "only-file", name: "仅附件.pdf", path: "/tmp/private/仅附件.pdf" },
      ], status: "completed", createdAt: "2026", updatedAt: "2026" },
      { id: "restored-answer", role: "assistant", text: "恢复的正文", status: "completed", createdAt: "2026", updatedAt: "2026" },
      { id: "empty-tool-assistant", role: "assistant", text: "", status: "completed", createdAt: "2026", updatedAt: "2026" },
      { id: "suggestions-only", role: "assistant", text: "", suggestedReplies: ["只按建议继续"], awaitingReply: true, status: "completed", createdAt: "2026", updatedAt: "2026" },
    ] } })));
    expect(screen.getByRole("button", { name: "只按建议继续" })).toBeTruthy();
    expect(screen.queryByTestId("pet-latest")).toBeNull();
    fireEvent.mouseEnter(screen.getByTestId("pet-conversation"));
    expect(Array.from(screen.getByRole("log").querySelectorAll('[data-author="assistant"]')).every(node => !!node.textContent?.trim())).toBe(true);
    expect(screen.getByRole("log").querySelector('[data-author="user"]')?.textContent).toBe("仅附件.pdf待处理");
    fireEvent.click(screen.getByRole("button", { name: "只按建议继续" }));
    expect(Socket.latest.sent.at(-1)).toMatchObject({ type: "op.submit", threadId: "a", payload: { op: { payload: { items: [{ type: "text", text: "只按建议继续" }] } } } });
  });

  it("每次悬停回到底部，单次展开中阅读旧消息时新内容不抢位置", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1200);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
    mount(); startThread();
    const conversation = screen.getByTestId("pet-conversation");
    fireEvent.mouseEnter(conversation);
    const history = screen.getByRole("log");
    expect(history.scrollTop).toBe(1200);
    history.scrollTop = 100;
    fireEvent.scroll(history);
    act(() => Socket.latest.receive(note("assistant.delta", { threadId: "a", turnId: "turn", itemId: "answer", payload: { text: "新的增量" } })));
    expect(history.scrollTop).toBe(100);
    fireEvent.mouseLeave(conversation);
    fireEvent.mouseEnter(conversation);
    expect(screen.getByRole("log").scrollTop).toBe(1200);
  });

  it("上报独立气泡的可见命中矩形，滚动裁剪后仍让透明间隙穿透", () => {
    let scrollOffset = 0;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("pet-character")) return new DOMRect(176, 432, 192, 208);
      if (this.dataset.testid === "pet-conversation") return new DOMRect(8, 8, 352, 632);
      if (this.querySelector('[data-testid="pet-latest"]') && this.dataset.petInteractive !== undefined) return new DOMRect(8, 240, 352, 80);
      if (this.getAttribute("role") === "log") return new DOMRect(8, 8, 352, 264);
      if (this.dataset.author === "user") return new DOMRect(132, -10 - scrollOffset, 228, 48);
      if (this.dataset.author === "assistant") return new DOMRect(8, 60 - scrollOffset, 260, 58);
      if (this.classList.contains("pet-reply")) return new DOMRect(8, 440, 160, 110);
      return new DOMRect();
    });
    mount(); startThread("前一条桌宠回复");
    act(() => Socket.latest.receive(note("assistant.delta", {
      threadId: "a", turnId: "second-turn", itemId: "latest-answer", payload: { text: "最新回复" },
    })));
    fireEvent.mouseEnter(screen.getByTestId("pet-conversation"));
    const regions = () => vi.mocked(window.handAgentPet!.setInteractiveRegions).mock.lastCall![0];
    expect(regions()).toEqual(expect.arrayContaining([
      { x: 8, y: 240, width: 352, height: 32 },
      { x: 132, y: 8, width: 228, height: 30 },
      { x: 8, y: 60, width: 260, height: 58 },
      { x: 8, y: 440, width: 160, height: 110 },
    ]));
    const hitsGap = () => regions().some((r) => 340 >= r.x && 340 < r.x + r.width && 100 >= r.y && 100 < r.y + r.height);
    expect(hitsGap()).toBe(false);
    scrollOffset = 100;
    fireEvent.scroll(screen.getByRole("log"));
    expect(regions()).toContainEqual({ x: 8, y: 8, width: 260, height: 10 });
    expect(hitsGap()).toBe(false);
  });

  it("隐藏后回复完成才亮红点，重建保留，点击角色查看清除；后台结果不解除隐藏", async () => {
    mount(); startThread("等你决定。");
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    act(() => {
      Socket.latest.receive(note("turn.started", { threadId: "a", turnId: "turn", payload: {} }));
      Socket.latest.receive(note("assistant.delta", { threadId: "a", turnId: "turn", itemId: "late", payload: { text: "后台的新结果" } }));
      Socket.latest.receive(note("user.message.recorded", { threadId: "a", payload: { messageId: "later", text: "用户补充" } }));
    });
    expect(screen.queryByLabelText("有已完成的回复")).toBeNull();
    expect(screen.queryByTestId("pet-conversation")).toBeNull();
    act(() => Socket.latest.receive(note("turn.completed", { threadId: "a", turnId: "turn", payload: { status: "completed" } })));
    expect(screen.getByLabelText("有已完成的回复")).toBeTruthy();
    expect(screen.queryByTestId("pet-conversation")).toBeNull();
    const messages = [{ id: "late", role: "assistant", text: "后台的新结果", status: "completed", createdAt: "2026", updatedAt: "2026" }];
    cleanup();
    controller = new PetThreadController({ petId: "pet-default", url: "ws://local/api/thread", WebSocketImpl: Socket });
    mount();
    await act(async () => Socket.latest.receive(note("thread.snapshot", { threadId: "a", payload: { messages, status: "idle" } })));
    expect(screen.getByLabelText("有已完成的回复")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    expect(screen.queryByLabelText("有已完成的回复")).toBeNull();
    expect(screen.getByTestId("pet-latest").textContent).toBe("后台的新结果");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "当前草稿" } });
    act(() => Socket.latest.receive(note("thread.started", { threadId: "b", payload: { preview: "另一段对话" } })));
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    act(() => Socket.latest.receive({
      type: "permission.requested", threadId: "a", requestId: "permission-a", timestamp: new Date().toISOString(),
      payload: { toolName: "file.write", toolCallId: "write-a", arguments: {} },
    }));
    expect(screen.getByTestId("pet-conversation")).toBeTruthy();
    expect(controller.getSnapshot()).toMatchObject({ threadId: "a", draft: "当前草稿" });
    expect(controller.store.getState().threadsById.a.permissionRequests).toHaveLength(1);
    expect(controller.store.getState().threadsById.b.permissionRequests).toHaveLength(0);
  });

  it("建议与自由输入继续排队，成功完成亮红点，查看后清除", async () => {
    mount(); startThread();
    fireEvent.mouseEnter(screen.getByTestId("pet-conversation"));
    fireEvent.click(screen.getByRole("button", { name: "请整理这份资料" }));
    const suggestion = Socket.latest.sent.filter((message) => message.type === "op.submit").at(-1)!;
    expect(suggestion.payload.op.payload).toEqual({ items: [{ type: "text", id: expect.any(String), text: "请整理这份资料" }] });
    await ackLast();
    act(() => Socket.latest.receive(note("turn.started", { threadId: "a", turnId: "executing", payload: {} })));
    const input = screen.getByRole("textbox", { name: "回复当前对话" });
    fireEvent.change(input, { target: { value: "补充一条" } });
    fireEvent.click(screen.getByRole("button", { name: "停止本轮" }));
    expect(Socket.latest.sent.at(-1)).toMatchObject({ type: "op.submit", threadId: "a", payload: { op: { type: "interrupt" } } });
    expect((input as HTMLTextAreaElement).value).toBe("补充一条");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(Socket.latest.sent.at(-1)?.payload.op.type).toBe("interrupt");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(Socket.latest.sent.filter((message) => message.type === "op.submit").at(-1)?.payload.op.payload.items[0].text).toBe("补充一条");
    act(() => Socket.latest.receive(note("user.message.recorded", { threadId: "a", payload: { messageId: "queued", text: "补充一条", pending: true } })));
    expect(screen.getByRole("log").textContent).toContain("待处理");
    fireEvent.contextMenu(screen.getByRole("button", { name: /月见八千代/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "对话" }));
    expect(screen.getByRole("button", { name: /^补充一条 running/ })).toBeTruthy();
    act(() => Socket.latest.receive(note("assistant.delta", { threadId: "a", turnId: "executing", itemId: "completed-answer", payload: { text: "已整理好资料" } })));
    expect(screen.queryByLabelText("有已完成的回复")).toBeNull();
    act(() => Socket.latest.receive(note("turn.completed", { threadId: "a", turnId: "executing", payload: { status: "completed" } })));
    expect(screen.getByRole("button", { name: /^补充一条 idle/ })).toBeTruthy();
    expect(screen.getByLabelText("有已完成的回复")).toBeTruthy();
    fireEvent.mouseEnter(screen.getByTestId("pet-conversation"));
    expect(screen.queryByLabelText("有已完成的回复")).toBeNull();
  });

  it("完成提示只采用当前 Thread 的成功回复，分片建议在完成后也可查看", () => {
    mount(); startThread();
    const pet = screen.getByRole("button", { name: /月见八千代/ });
    fireEvent.click(pet);
    for (const [turnId, status] of [["failed", "failed"], ["interrupted", "interrupted"], ["tools", "completed"]]) {
      act(() => {
        Socket.latest.receive(note("turn.started", { threadId: "a", turnId, payload: {} }));
        if (turnId !== "tools") Socket.latest.receive(note("assistant.delta", { threadId: "a", turnId, itemId: turnId, payload: { text: "部分回复" } }));
        Socket.latest.receive(note("turn.completed", { threadId: "a", turnId, payload: { status } }));
      });
      expect(screen.queryByLabelText("有已完成的回复")).toBeNull();
    }
    act(() => {
      Socket.latest.receive(note("thread.started", { threadId: "b", payload: { preview: "后台任务" } }));
      Socket.latest.receive(note("turn.started", { threadId: "b", turnId: "other", payload: {} }));
      Socket.latest.receive(note("assistant.delta", { threadId: "b", turnId: "other", itemId: "other", payload: { text: "其他任务结果" } }));
      Socket.latest.receive(note("turn.completed", { threadId: "b", turnId: "other", payload: { status: "completed" } }));
      Socket.latest.receive(note("turn.started", { threadId: "a", turnId: "suggestions", payload: {} }));
      Socket.latest.receive(note("assistant.delta", { threadId: "a", turnId: "suggestions", itemId: "suggestions", payload: { text: "", suggestedReplies: ["下一步"] } }));
      Socket.latest.receive(note("assistant.delta", { threadId: "a", turnId: "suggestions", itemId: "suggestions", payload: { text: "", awaitingReply: true } }));
    });
    expect(screen.queryByLabelText("有已完成的回复")).toBeNull();
    act(() => Socket.latest.receive(note("turn.completed", { threadId: "a", turnId: "suggestions", payload: { status: "completed" } })));
    expect(screen.getByLabelText("有已完成的回复")).toBeTruthy();
    fireEvent.click(pet);
    expect(screen.getByRole("button", { name: "下一步" })).toBeTruthy();
    expect(screen.queryByLabelText("有已完成的回复")).toBeNull();
    act(() => {
      Socket.latest.receive(note("turn.started", { threadId: "a", turnId: "next", payload: {} }));
      Socket.latest.receive(note("assistant.delta", { threadId: "a", turnId: "next", itemId: "next", payload: { text: "新的回复" } }));
      Socket.latest.receive(note("turn.completed", { threadId: "a", turnId: "next", payload: { status: "completed" } }));
    });
    expect(screen.getByLabelText("有已完成的回复")).toBeTruthy();
    fireEvent.focus(screen.getByRole("textbox"));
    expect(screen.queryByLabelText("有已完成的回复")).toBeNull();
  });

  it("拖动经过不提交，最终松手区域决定新建还是追加", async () => {
    mount(); startThread();
    const dataTransfer = { types: ["text/plain"], files: [], getData: (type: string) => type === "text/plain" ? "拖入的资料" : "" };
    const pet = screen.getByRole("button", { name: /月见八千代/ });
    const bubble = screen.getByTestId("pet-conversation");
    const count = Socket.latest.sent.length;
    fireEvent.dragEnter(pet, { dataTransfer });
    fireEvent.dragOver(pet, { dataTransfer });
    expect(screen.getByText(/· 新对话/)).toBeTruthy();
    expect(Socket.latest.sent).toHaveLength(count);
    fireEvent.dragOver(bubble, { dataTransfer });
    expect(screen.getByText("添加到当前对话")).toBeTruthy();
    fireEvent.drop(bubble, { dataTransfer });
    await waitFor(() => expect(Socket.latest.sent.at(-1)?.type).toBe("op.submit"));
    expect(Socket.latest.sent.at(-1)).toMatchObject({ threadId: "a", payload: { op: { payload: { items: [{ text: "拖入的资料" }] } } } });
    fireEvent.drop(pet, { dataTransfer });
    await waitFor(() => expect(Socket.latest.sent.at(-1)?.type).toBe("thread.start"));
  });

  it.each(["image/png", "application/pdf"])("浏览器 File 拖入 %s 只交付原路径", async (type) => {
    mount(); startThread();
    const file = new File(["attachment bytes"], type === "image/png" ? "photo.png" : "report.pdf", { type });
    const dataTransfer = { types: ["Files"], files: [file], getData: () => "" };
    fireEvent.drop(screen.getByTestId("pet-conversation"), { dataTransfer });
    await waitFor(() => expect(Socket.latest.sent.at(-1)?.type).toBe("op.submit"));
    expect(Socket.latest.sent.at(-1)?.payload.op.payload.items[0]).toMatchObject({ type: "file_reference", path: `/tmp/${file.name}`, name: file.name, mimeType: type });
  });

  it.each(["pet", "conversation"] as const)("拖入 %s 后在读取文件期间隐藏，读取与提交完成均不解除隐藏", async (target) => {
    mount(); startThread();
    const file = new File(["pdf bytes"], "report.pdf", { type: "application/pdf" });
    const pet = screen.getByRole("button", { name: /月见八千代/ });
    fireEvent.drop(target === "pet" ? pet : screen.getByTestId("pet-conversation"), {
      dataTransfer: { types: ["Files"], files: [file], getData: () => "" },
    });
    fireEvent.click(pet);
    expect(screen.queryByTestId("pet-conversation")).toBeNull();
    await act(async () => {});
    const submitted = Socket.latest.sent.at(-1)!;
    expect(submitted.type).toBe(target === "pet" ? "thread.start" : "op.submit");
    expect(screen.queryByTestId("pet-conversation")).toBeNull();
    if (target === "pet") act(() => Socket.latest.receive(note("thread.started", {
      commandId: submitted.commandId, threadId: "b", payload: { preview: "新资料" },
    })));
    expect(screen.queryByTestId("pet-conversation")).toBeNull();
    fireEvent.click(pet);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "回复当前对话" }));
  });

  it("松手后异步接收期间主动切换另一 Thread，附件仍追加松手时的对话", async () => {
    mount(); startThread();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A 的草稿" } });
    const file = new File(["pdf bytes"], "report.pdf", { type: "application/pdf" });
    fireEvent.drop(screen.getByTestId("pet-conversation"), { dataTransfer: { types: ["Files"], files: [file], getData: () => "" } });
    act(() => Socket.latest.receive(note("thread.started", { threadId: "b", payload: { preview: "后建对话", createdAt: "2026-09-13T02:00:00.000Z" } })));
    expect(controller.getSnapshot()).toMatchObject({ threadId: "a", draft: "A 的草稿" });
    fireEvent.contextMenu(screen.getByRole("button", {name:/月见八千代/}));
    fireEvent.click(screen.getByRole("menuitem", {name:"对话"}));
    fireEvent.click(screen.getByRole("button", {name:/^后建对话/}));
    await act(async () => {});
    await waitFor(() => expect(Socket.latest.sent.at(-1)?.type).toBe("op.submit"));
    expect(Socket.latest.sent.at(-1)).toMatchObject({ threadId: "a", payload: { op: { payload: { items: [{ type:"file_reference", path: "/tmp/report.pdf", name: "report.pdf" }] } } } });
    expect(controller.getSnapshot().threadId).toBe("b");
    expect(controller.petId).toBe("pet-default");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "B 的草稿" } });
    fireEvent.contextMenu(screen.getByRole("button", { name: /月见八千代/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "对话" }));
    fireEvent.click(screen.getByRole("button", { name: /^我的资料/ }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("A 的草稿");
    let finishPicking!: (paths: string[]) => void;
    window.handAgentPet!.chooseFiles = () => new Promise(resolve => { finishPicking = resolve; });
    fireEvent.click(screen.getByRole("button", { name: "添加文件" }));
    fireEvent.click(screen.getByRole("button", { name: "新建对话" }));
    await act(async () => finishPicking(["/tmp/context.txt"]));
    expect(controller.getSnapshot()).toMatchObject({ threadId: null, files: [] });
    await act(async () => { await controller.selectThread("a"); });
    expect(screen.getByRole("button", { name: "移除 context.txt" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "移除 context.txt" }));
    expect(controller.getSnapshot().files).toEqual([]);
  });
});
