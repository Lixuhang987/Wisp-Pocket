// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/activity-window/App.tsx";
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
const note = (type: string, extra: any = {}) => ({ type, notificationId: String(++sequence), timestamp: "2026-09-13T01:00:00.000Z", ...extra, ...(extra.payload ? {payload: {petSnapshot:{petId:"pet-default",revision:1,name:"Default",rolePrompt:"Help"},petId:"pet-default",petRevision:1,rootPath:"/tmp",...extra.payload}} : {}) });
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.handAgentPet = {getPathForFile: file=>`/tmp/${file.name}`,chooseFiles:async()=>[],setReceiving:vi.fn(),showPet:async()=>{},hidePet:vi.fn(),onReveal:()=>()=>{}, setLayout: vi.fn(), setInteractiveRegions: vi.fn(), beginMove: vi.fn(), move: vi.fn(), endMove: vi.fn() };
  controller = new PetThreadController({ petId:"pet-default", url: "ws://local/api/thread", WebSocketImpl: Socket });
});
afterEach(() => { cleanup(); controller.disconnect(); vi.restoreAllMocks(); });

async function ackLast() {
  const sent=Socket.latest.sent.at(-1)!;
  await act(async()=>Socket.latest.receive(note("user.message.recorded",{threadId:sent.threadId,payload:{messageId:sent.payload.op.opId,text:sent.payload.op.payload.items[0].text,items:sent.payload.op.payload.items}})));
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
    fireEvent.change(input, { target: { value: "帮我安排今天的阅读" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    const starts = Socket.latest.sent.filter((message) => message.type === "thread.start");
    expect(starts).toHaveLength(1);
    expect(input.value).toBe("帮我安排今天的阅读");
    act(() => Socket.latest.receive(note("thread.started", { commandId: starts[0]!.commandId, threadId: "first", payload: { preview: "阅读" } })));
    const submitted = Socket.latest.sent.at(-1)!;
    expect(submitted).toMatchObject({ type: "op.submit", threadId: "first", payload: { op: { opId: starts[0]!.commandId } } });
    expect(submitted.payload.op.payload).toEqual({ items: [{ type: "text", id: expect.any(String), text: "帮我安排今天的阅读" }] });
    expect(input.value).toBe("帮我安排今天的阅读");
    fireEvent.change(input, { target: { value: "还有另一条补充" } });
    await act(async () => Socket.latest.receive(note("user.message.recorded", {
      threadId: "first", payload: { messageId: submitted.payload.op.opId, text: "帮我安排今天的阅读", items: submitted.payload.op.payload.items, pending: true },
    })));
    expect(input.value).toBe("还有另一条补充");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(Socket.latest.sent.at(-1)).toMatchObject({ type: "op.submit", threadId: "first", payload: { op: { payload: { items: [{ text: "还有另一条补充" }] } } } });
    expect(input.value).toBe("还有另一条补充");
    await ackLast();
    expect(input.value).toBe("");
    expect(Socket.latest.sent.filter((message) => message.type === "thread.start")).toHaveLength(1);
  });

  it.each([false, true])("首次文字提交失败保留可重试草稿，已创建 Thread=%s", async (created) => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    let input = screen.getByRole("textbox", { name: "回复当前对话" }) as HTMLTextAreaElement;
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
      id: "first", petId: "pet-default", petRevision: 1, rootPath: "/tmp", status: "idle",
      preview: "首条", messageCount: 0, createdAt: "2026", updatedAt: "2026",
    }] : [] } })));
    input = screen.getByRole("textbox", { name: "回复当前对话" }) as HTMLTextAreaElement;
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
    expect(input.value).toBe("不能丢掉的首条输入");
    await act(async () => Socket.latest.receive(note("user.message.recorded", {
      threadId: "first", payload: { messageId: accepted.payload.op.opId, text: "不能丢掉的首条输入", items: accepted.payload.op.payload.items },
    })));
    expect(input.value).toBe("");
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
    await act(async () => {
      Socket.latest.receive(note("thread.started", { commandId: start.commandId, threadId: "first", payload: { preview: "首条" } }));
      Socket.latest.receive(accepted
        ? note("user.message.recorded", { threadId: "first", payload: { messageId: start.commandId, text: "暂时收起这条输入" } })
        : note("thread.error", { threadId: "first", payload: { message: "保存输入失败" } }));
    });
    expect(screen.queryByTestId("pet-conversation")).toBeNull();
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
    const heading = bubble.querySelector(".pet-conversation-heading")!;
    expect(bubble.querySelector(".pet-history-content")!.contains(heading)).toBe(true);
    expect(screen.queryByRole("log")).toBeNull();
    expect(screen.getByTestId("pet-latest").className).toContain("pet-latest");
    expect(vi.mocked(window.handAgentPet!.setLayout).mock.lastCall?.[0]).toBe("compact");
    fireEvent.mouseEnter(bubble);
    expect(screen.getByTestId("pet-latest").textContent).toContain("第五行全文");
    expect(screen.getByRole("log").querySelector('[data-author="user"]')?.textContent).toContain("我的资料");
    expect(screen.getByRole("log").contains(heading)).toBe(true);
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

  it("右键菜单进入伙伴、对话、隐藏和大小调节，刷新命中并恢复偏好，回复节点与草稿保持不变", () => {
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
    expect(screen.getByRole("region", { name: "本宠对话" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    fireEvent.contextMenu(pet);
    fireEvent.click(screen.getByRole("menuitem", { name: "伙伴" }));
    expect(screen.getByRole("region", { name: "伙伴管理" })).toBeTruthy();
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

  it("悬停时最新回复和全部建议进入历史的同一滚动区，回复框保持固定节点", () => {
    mount(); startThread("前一条桌宠回复");
    act(() => Socket.latest.receive(note("thread.snapshot", { threadId: "a", payload: {
      status: "idle", petSnapshot: { petId: "pet-default", revision: 2, name: "原名称", rolePrompt: "原角色" },
      messages: [
        { id: "input", role: "user", text: "我的资料", status: "completed", createdAt: "2026", updatedAt: "2026" },
        { id: "answer", role: "assistant", text: "前一条桌宠回复", status: "completed", createdAt: "2026", updatedAt: "2026" },
      ],
    } })));
    expect(screen.getByText("创建时：原名称 · 角色 v2")).toBeTruthy();
    act(() => Socket.latest.receive(note("assistant.delta", {
      threadId: "a", turnId: "second-turn", itemId: "latest-answer",
      payload: { text: "最新的回复留在角色头上", suggestedReplies: ["继续阅读"], awaitingReply: true },
    })));
    const input = screen.getByRole("textbox", { name: "回复当前对话" });
    fireEvent.mouseEnter(screen.getByTestId("pet-conversation"));
    expect(screen.getAllByText("最新的回复留在角色头上")).toHaveLength(1);
    const history = screen.getByRole("log");
    expect(history.contains(screen.getByTestId("pet-latest"))).toBe(true);
    expect(history.contains(screen.getByRole("button", { name: "继续阅读" }))).toBe(true);
    expect(history.contains(input)).toBe(false);
    expect(screen.getByTestId("pet-conversation").querySelectorAll("[data-pet-scroll-viewport]")).toHaveLength(1);
    expect(history.querySelector('[data-author="assistant"]')?.textContent).toContain("前一条桌宠回复");
    expect(history.querySelector('[data-author="user"]')?.textContent).toContain("我的资料");
    fireEvent.click(screen.getByRole("button", { name: "继续阅读" }));
    expect(Socket.latest.sent.at(-1)).toMatchObject({
      type: "op.submit", threadId: "a", payload: { op: { payload: { items: [{ type: "text", text: "继续阅读" }] } } },
    });
    fireEvent.mouseLeave(screen.getByTestId("pet-conversation"));
    expect(screen.getByRole("textbox", { name: "回复当前对话" })).toBe(input);
    expect(screen.getByTestId("pet-latest").textContent).toBe("最新的回复留在角色头上");
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

  it("隐藏后后台结果仍隐藏，点击角色恢复；最新用户消息不覆盖桌宠消息", () => {
    mount(); startThread("等你决定。");
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    act(() => {
      Socket.latest.receive(note("assistant.delta", { threadId: "a", turnId: "turn", itemId: "late", payload: { text: "后台的新结果" } }));
      Socket.latest.receive(note("user.message.recorded", { threadId: "a", payload: { messageId: "later", text: "用户补充" } }));
    });
    expect(screen.queryByTestId("pet-conversation")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    expect(screen.getByTestId("pet-latest").textContent).toBe("后台的新结果");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "当前草稿" } });
    act(() => Socket.latest.receive(note("thread.started", { threadId: "b", payload: { preview: "另一段对话" } })));
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    act(() => Socket.latest.receive({
      type: "permission.requested", threadId: "b", requestId: "permission-b", timestamp: new Date().toISOString(),
      payload: { toolName: "file.write", toolCallId: "write-b", arguments: {} },
    }));
    expect(screen.getByTestId("pet-conversation")).toBeTruthy();
    expect(controller.getSnapshot()).toMatchObject({ threadId: "a", draft: "当前草稿" });
    expect(controller.store.getState().threadsById.a.permissionRequests).toHaveLength(0);
    expect(controller.store.getState().threadsById.b.permissionRequests).toHaveLength(1);
  });

  it("建议按钮和自由输入都提交普通 UserInput，执行中仍可回复并显示待处理", async () => {
    mount(); startThread();
    fireEvent.mouseEnter(screen.getByTestId("pet-conversation"));
    fireEvent.click(screen.getByRole("button", { name: "请整理这份资料" }));
    const suggestion = Socket.latest.sent.filter((message) => message.type === "op.submit").at(-1)!;
    expect(suggestion.payload.op.payload).toEqual({ items: [{ type: "text", id: expect.any(String), text: "请整理这份资料" }] });
    await ackLast();
    act(() => Socket.latest.receive(note("turn.started", { threadId: "a", turnId: "executing", payload: {} })));
    const input = screen.getByRole("textbox", { name: "回复当前对话" });
    fireEvent.change(input, { target: { value: "补充一条" } });
    fireEvent.click(screen.getByRole("button", { name: "发送回复" }));
    expect(Socket.latest.sent.filter((message) => message.type === "op.submit").at(-1)?.payload.op.payload.items[0].text).toBe("补充一条");
    act(() => Socket.latest.receive(note("user.message.recorded", { threadId: "a", payload: { messageId: "queued", text: "补充一条", pending: true } })));
    expect(screen.getByRole("log").textContent).toContain("待处理");
    fireEvent.contextMenu(screen.getByRole("button", { name: /月见八千代/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "对话" }));
    expect(screen.getByRole("button", { name: /^补充一条 running/ })).toBeTruthy();
    act(() => Socket.latest.receive(note("turn.completed", { threadId: "a", turnId: "executing", payload: { status: "completed" } })));
    expect(screen.getByRole("button", { name: /^补充一条 idle/ })).toBeTruthy();
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
    expect(Socket.latest.sent.at(-1)?.payload.op.payload.items[0]).toMatchObject({ type: "text", text: expect.stringContaining(`/tmp/${file.name}`) });
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
    expect(Socket.latest.sent.at(-1)).toMatchObject({ threadId: "a", payload: { op: { payload: { items: [{ type:"text", text: expect.stringContaining("/tmp/report.pdf") }] } } } });
    expect(controller.getSnapshot().threadId).toBe("b");
    expect(controller.petId).toBe("pet-default");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "B 的草稿" } });
    fireEvent.contextMenu(screen.getByRole("button", { name: /月见八千代/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "对话" }));
    fireEvent.click(screen.getByRole("button", { name: /^我的资料/ }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("A 的草稿");
  });
});
