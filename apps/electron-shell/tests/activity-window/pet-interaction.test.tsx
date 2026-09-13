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
const note = (type: string, extra: object = {}) => ({ type, notificationId: String(++sequence), timestamp: "2026-09-13T01:00:00.000Z", ...extra });
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.handAgentPet = { setLayout: vi.fn(), setInteractiveRegions: vi.fn(), beginMove: vi.fn(), move: vi.fn(), endMove: vi.fn() };
  controller = new PetThreadController({ url: "ws://local/api/thread", WebSocketImpl: Socket });
});
afterEach(() => { cleanup(); controller.disconnect(); vi.restoreAllMocks(); });

function mount() {
  render(<App controller={controller} />);
  act(() => Socket.latest.open());
}

function startThread(text = "第一行\n第二行\n第三行\n第四行\n第五行全文") {
  act(() => {
    Socket.latest.receive(note("thread.started", { threadId: "a", payload: { preview: "资料" } }));
    Socket.latest.receive(note("user.message.recorded", { threadId: "a", payload: { messageId: "input", text: "我的资料", items: [{ type: "text", id: "item", text: "我的资料" }] } }));
    Socket.latest.receive(note("assistant.delta", { threadId: "a", turnId: "turn", itemId: "answer", payload: { text, suggestedReplies: ["请整理这份资料"], awaitingReply: true } }));
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
      if (started) Socket.latest.receive(note("thread.started", { threadId: "a", payload: { preview: "资料" } }));
      Socket.latest.receive(note("thread.error", { ...(started ? { threadId: "a" } : {}), payload: { message: "保存输入失败：磁盘已满" } }));
    });
    expect(screen.getByRole("alert").textContent).toContain("磁盘已满");
    fireEvent.click(screen.getByRole("button", { name: "隐藏气泡" }));
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

  it("启动只显示角色；最新消息常态折叠，悬停历史与输入焦点控制展开", () => {
    mount();
    expect(screen.getByRole("button", { name: /月见八千代/ })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    startThread();
    const bubble = screen.getByTestId("pet-conversation");
    expect(screen.getByTestId("pet-latest").className).toContain("pet-latest");
    expect(window.handAgentPet?.setLayout).toHaveBeenLastCalledWith("compact");
    fireEvent.mouseEnter(bubble);
    expect(screen.getByTestId("pet-latest").textContent).toContain("第五行全文");
    expect(screen.getByRole("log").querySelector('[data-author="user"]')?.textContent).toContain("我的资料");
    const input = screen.getByRole("textbox", { name: "回复当前对话" });
    act(() => input.focus());
    fireEvent.mouseLeave(bubble);
    expect(screen.getByRole("log")).toBeTruthy();
    act(() => input.blur());
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("悬停保留同一个最新回复气泡，较早消息独立展开且建议继续走普通回复", () => {
    mount(); startThread("前一条桌宠回复");
    act(() => Socket.latest.receive(note("assistant.delta", {
      threadId: "a", turnId: "second-turn", itemId: "latest-answer",
      payload: { text: "最新的回复留在角色头上", suggestedReplies: ["继续阅读"], awaitingReply: true },
    })));
    const latest = screen.getByTestId("pet-latest");
    const surface = latest.parentElement;
    fireEvent.mouseEnter(screen.getByTestId("pet-conversation"));
    expect(screen.getByTestId("pet-latest")).toBe(latest);
    expect(latest.parentElement).toBe(surface);
    expect(screen.getAllByText("最新的回复留在角色头上")).toHaveLength(1);
    const history = screen.getByRole("log");
    expect(history.querySelector('[data-author="assistant"]')?.textContent).toContain("前一条桌宠回复");
    expect(history.querySelector('[data-author="user"]')?.textContent).toContain("我的资料");
    fireEvent.click(screen.getByRole("button", { name: "继续阅读" }));
    expect(Socket.latest.sent.at(-1)).toMatchObject({
      type: "op.submit", threadId: "a", payload: { op: { payload: { items: [{ type: "text", text: "继续阅读" }] } } },
    });
    fireEvent.mouseLeave(screen.getByTestId("pet-conversation"));
    expect(screen.getByTestId("pet-latest")).toBe(latest);
  });

  it("上报独立气泡的可见命中矩形，滚动裁剪后仍让透明间隙穿透", () => {
    let scrollOffset = 0;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("pet-character")) return new DOMRect(176, 432, 192, 208);
      if (this.dataset.testid === "pet-conversation") return new DOMRect(8, 8, 352, 632);
      if (this.classList.contains("pet-current-bubble")) return new DOMRect(8, 280, 352, 148);
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
      { x: 8, y: 280, width: 352, height: 148 },
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
    fireEvent.click(screen.getByRole("button", { name: "隐藏气泡" }));
    act(() => {
      Socket.latest.receive(note("assistant.delta", { threadId: "a", turnId: "turn", itemId: "late", payload: { text: "后台的新结果" } }));
      Socket.latest.receive(note("user.message.recorded", { threadId: "a", payload: { messageId: "later", text: "用户补充" } }));
    });
    expect(screen.queryByTestId("pet-conversation")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /月见八千代/ }));
    expect(screen.getByTestId("pet-latest").textContent).toBe("后台的新结果");
  });

  it("建议按钮和自由输入都提交普通 UserInput，执行中仍可回复并显示待处理", () => {
    mount(); startThread();
    fireEvent.mouseEnter(screen.getByTestId("pet-conversation"));
    fireEvent.click(screen.getByRole("button", { name: "请整理这份资料" }));
    const suggestion = Socket.latest.sent.filter((message) => message.type === "op.submit").at(-1)!;
    expect(suggestion.payload.op.payload).toEqual({ items: [{ type: "text", id: expect.any(String), text: "请整理这份资料" }] });
    act(() => Socket.latest.receive(note("turn.started", { threadId: "a", turnId: "executing", payload: {} })));
    const input = screen.getByRole("textbox", { name: "回复当前对话" });
    fireEvent.change(input, { target: { value: "补充一条" } });
    fireEvent.click(screen.getByRole("button", { name: "发送回复" }));
    expect(Socket.latest.sent.filter((message) => message.type === "op.submit").at(-1)?.payload.op.payload.items[0].text).toBe("补充一条");
    act(() => Socket.latest.receive(note("user.message.recorded", { threadId: "a", payload: { messageId: "queued", text: "补充一条", pending: true } })));
    expect(screen.getByRole("log").textContent).toContain("待处理");
  });

  it("拖动经过不提交，最终松手区域决定新建还是追加", async () => {
    mount(); startThread();
    const dataTransfer = { types: ["text/plain"], files: [], getData: (type: string) => type === "text/plain" ? "拖入的资料" : "" };
    const pet = screen.getByRole("button", { name: /月见八千代/ });
    const bubble = screen.getByTestId("pet-conversation");
    const count = Socket.latest.sent.length;
    fireEvent.dragEnter(pet, { dataTransfer });
    fireEvent.dragOver(pet, { dataTransfer });
    expect(screen.getByText("新对话")).toBeTruthy();
    expect(Socket.latest.sent).toHaveLength(count);
    fireEvent.dragOver(bubble, { dataTransfer });
    expect(screen.getByText("添加到当前对话")).toBeTruthy();
    fireEvent.drop(bubble, { dataTransfer });
    await waitFor(() => expect(Socket.latest.sent.at(-1)?.type).toBe("op.submit"));
    expect(Socket.latest.sent.at(-1)).toMatchObject({ threadId: "a", payload: { op: { payload: { mode: "inspect", items: [{ text: "拖入的资料" }] } } } });
    fireEvent.drop(pet, { dataTransfer });
    await waitFor(() => expect(Socket.latest.sent.at(-1)?.type).toBe("thread.start"));
  });

  it.each(["image/png", "application/pdf"])("浏览器 File 拖入 %s 会读取字节并发送，不依赖原路径", async (type) => {
    mount(); startThread();
    const file = new File(["attachment bytes"], type === "image/png" ? "photo.png" : "report.pdf", { type });
    const dataTransfer = { types: ["Files"], files: [file], getData: () => "" };
    fireEvent.drop(screen.getByTestId("pet-conversation"), { dataTransfer });
    await waitFor(() => expect(Socket.latest.sent.at(-1)?.type).toBe("op.submit"));
    expect(Socket.latest.sent.at(-1)?.payload.op.payload.items[0]).toMatchObject({ type: type === "image/png" ? "image" : "pdf", name: file.name, base64: btoa("attachment bytes") });
  });

  it("松手后异步读取附件期间新建另一 Thread，附件仍追加松手时的对话", async () => {
    mount(); startThread();
    let reader: FileReader | undefined;
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) { reader = this; });
    const file = new File(["pdf bytes"], "report.pdf", { type: "application/pdf" });
    fireEvent.drop(screen.getByTestId("pet-conversation"), { dataTransfer: { types: ["Files"], files: [file], getData: () => "" } });
    act(() => Socket.latest.receive(note("thread.started", { threadId: "b", payload: { preview: "后建对话", createdAt: "2026-09-13T02:00:00.000Z" } })));
    Object.defineProperty(reader!, "result", { value: `data:application/pdf;base64,${btoa("pdf bytes")}` });
    await act(async () => reader!.onload?.(new ProgressEvent("load") as ProgressEvent<FileReader>));
    await waitFor(() => expect(Socket.latest.sent.at(-1)?.type).toBe("op.submit"));
    expect(Socket.latest.sent.at(-1)).toMatchObject({ threadId: "a", payload: { op: { payload: { items: [{ name: "report.pdf" }] } } } });
    expect(controller.getSnapshot().threadId).toBe("b");
  });
});
