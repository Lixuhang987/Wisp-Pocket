// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { installPetBridge, petFixture } from "./petBridgeFixture.ts";
import { PetThreadController } from "../../src/activity-window/petThreadController.ts";

class Socket {
  static latest: Socket;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: any[] = [];
  constructor() { Socket.latest = this; }
  send(raw: string) { this.sent.push(JSON.parse(raw)); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(value: object) { this.onmessage?.({ data: JSON.stringify(value) }); }
}

let controller: PetThreadController;
const otherControllers: PetThreadController[] = [];
let sequence = 0;
const timestamp = "2026-10-02T00:00:00.000Z";
const note = (type: string, payload: object, extra: object = {}) => ({
  type, payload, ...extra, notificationId: String(++sequence), timestamp,
});
const entry = (id: string, petId = "pet-a") => ({
  id, workspaceId: "workspace-shared", rootPath: "/tmp", status: "idle",
  createdAt: timestamp, updatedAt: timestamp, preview: id, messageCount: 0,
});
afterEach(() => { controller?.disconnect(); otherControllers.splice(0).forEach(item => item.disconnect()); localStorage.clear(); delete window.handAgentSettings; });

it("工作区历史分页与已选任务恢复由前端关联决定", () => {
  const fixture=installPetBridge([petFixture("pet-a","workspace-shared","selected")]);
  controller = new PetThreadController({ url: "ws://local/api/thread", WebSocketImpl: Socket, petId: "pet-a" });
  controller.connect();
  let socket = Socket.latest;
  socket.open();
  socket.receive(note("thread.listed", { threads: [entry("selected")], nextCursor: "page-2" }));
  controller.setDraft("当前输入不能丢");
  controller.listMore();
  expect(socket.sent.at(-1)).toMatchObject({ type: "thread.list", payload: { cursor: "page-2" } });
  socket.receive(note("thread.listed", { threads: [entry("remaining")] }));
  expect(controller.getSnapshot().history.map(thread => thread.id)).toEqual(["selected", "remaining"]);
  expect(controller.getSnapshot()).toMatchObject({ threadId: "selected", draft: "当前输入不能丢" });

  // 断连期间，当前对话在另一个前端被删除；首屏不包含它尚不足以判定删除。
  controller.disconnect();
  controller.connect();
  socket = Socket.latest;
  socket.open();
  socket.receive(note("thread.listed", {
    threads: [...Array.from({ length: 50 }, (_, i) => entry(`remaining-${i}`))],
    nextCursor: "next",
  }));
  expect(socket.sent.at(-1)).toMatchObject({ type: "thread.resume", threadId: "selected" });
  expect(controller.getSnapshot()).toMatchObject({ threadId: "selected", draft: "当前输入不能丢" });
  socket.receive(note("thread.error", { code: "not_found", message: "Thread not found" }, { threadId: "selected" }));
  expect(controller.getSnapshot()).toMatchObject({ threadId: null, draft: "" });
  fixture.publish([petFixture("pet-a","workspace-shared",null)]);
  void fixture.bridge.assignPet({petId:"pet-a",workspaceId:"workspace-shared",threadId:"remaining-0"});
  expect(controller.getSnapshot()).toMatchObject({threadId:"remaining-0"});
  expect(socket.sent.at(-1)).toMatchObject({ type: "thread.resume", threadId: "remaining-0" });
  expect(JSON.parse(localStorage.getItem("handagent.pet-ui.v1.pet-a")!).drafts.selected).toBeUndefined();
});

it("五宠的两段历史与新话题草稿在 renderer 重建后分别恢复", () => {
  const fixture=installPetBridge(Array.from({length:5},(_,i)=>petFixture(`pet-${i}`,"workspace-shared",`a-${i}`)));
  function openPet(petId: string, threads: string[]) {
    const pet = new PetThreadController({ url: "ws://local/api/thread", WebSocketImpl: Socket, petId });
    otherControllers.push(pet);
    pet.connect();
    Socket.latest.open();
    Socket.latest.receive(note("thread.listed", { threads: threads.map(id => entry(id, petId)) }));
    return pet;
  }
  for (let i = 0; i < 5; i++) {
    const pet = openPet(`pet-${i}`, [`a-${i}`, `b-${i}`]);
    pet.setDraft(`A${i}`);
    pet.addFiles([`/tmp/A${i}.pdf`]);
    pet.selectThread(`b-${i}`);
    pet.setDraft(`B${i}`);
    pet.addFiles([`/tmp/B${i}.pdf`]);
    pet.newTopic();
    pet.setDraft(`New${i}`);
    pet.addFiles([`/tmp/New${i}.pdf`]);
    if (i % 2 === 0) pet.revealBubble(); else pet.hideBubble();
    pet.disconnect();
  }
  for (let i = 0; i < 5; i++) {
    const pet = openPet(`pet-${i}`, [`a-${i}`, `b-${i}`]);
    expect(pet.getSnapshot()).toMatchObject({ threadId: null, draft: `New${i}`, bubbleVisible: i % 2 === 0 });
    expect(pet.getSnapshot().files.map(file => file.path)).toEqual([`/tmp/New${i}.pdf`]);
    pet.selectThread(`a-${i}`);
    expect(pet.getSnapshot().draft).toBe(`A${i}`);
    expect(pet.getSnapshot().files.map(file => file.path)).toEqual([`/tmp/A${i}.pdf`]);
    pet.selectThread(`b-${i}`);
    expect(pet.getSnapshot().draft).toBe(`B${i}`);
    expect(pet.getSnapshot().files.map(file => file.path)).toEqual([`/tmp/B${i}.pdf`]);
  }
});
