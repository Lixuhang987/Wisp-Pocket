import {
  encodeThreadList,
  encodeThreadResume,
  encodeOpSubmit,
  encodePetList,
  type RuntimeOp,
  type ThreadListEntry,
  isServerRequest,
  isThreadNotification,
  type ServerRequest,
  type ThreadNotification,
} from "../protocol/threadProtocol.ts";

export type ConnectionState = "disconnected" | "connecting" | "connected";

type WebSocketLike = {
  readyState: number;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  send(message: string): void;
  close(): void;
};

type WebSocketConstructor = new (url: string) => WebSocketLike;

const WS_CONNECTING = 0;
const WS_OPEN = 1;

export class ThreadSocketClient {
  private socket: WebSocketLike | null = null;
  private manuallyClosed = false;
  private outboundQueue: string[] = [];
  private historyPages: ThreadListEntry[] = [];
  private loadingHistoryPages = false;

  constructor(private readonly options: {
    url: string;
    petId?: string;
    listWorkspaces?: boolean;
    WebSocketImpl?: WebSocketConstructor;
    now?: () => string;
    id?: () => string;
    onConnectionState: (state: ConnectionState) => void;
    onNotification: (notification: ThreadNotification) => void;
    onRequest: (request: ServerRequest) => void;
  }) {}

  connect(): void {
    this.manuallyClosed = false;
    if (this.hasActiveSocket()) {
      return;
    }
    this.openSocket();
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.outboundQueue = [];
    this.socket?.close();
    this.socket = null;
    this.options.onConnectionState("disconnected");
  }

  sendRaw(message: string): void {
    if (this.socket?.readyState === WS_OPEN) {
      this.socket.send(message);
      return;
    }
    this.outboundQueue.push(message);
  }

  listThreads(cursor?: string): void {
    if (!cursor && !this.options.petId) { this.historyPages = []; this.loadingHistoryPages = true; }
    this.sendRaw(encodeThreadList({
      petId: this.options.petId, cursor,
      commandId: this.nextId(),
      timestamp: this.now(),
    }));
  }

  resumeThread(threadId: string): void {
    this.sendRaw(encodeThreadResume({
      threadId,
      commandId: this.nextId(),
      timestamp: this.now(),
    }));
  }

  submitOp(threadId: string, op: RuntimeOp): void {
    this.sendRaw(encodeOpSubmit({
      threadId,
      commandId: this.nextId(),
      timestamp: this.now(),
      op,
    }));
  }

  private openSocket(): void {
    const WebSocketImpl = this.options.WebSocketImpl ?? (WebSocket as unknown as WebSocketConstructor);
    this.options.onConnectionState("connecting");
    const socket = new WebSocketImpl(this.options.url);
    this.socket = socket;

    socket.onopen = () => {
      if (socket !== this.socket) {
        return;
      }
      this.options.onConnectionState("connected");
      this.flushOutboundQueue(socket);
      this.sendRaw(encodePetList({
        commandId: this.nextId(),
        timestamp: this.now(),
      }));
      if (this.options.listWorkspaces) this.sendRaw(JSON.stringify({type:"workspace.list", commandId:this.nextId(),timestamp:this.now()}));
      this.listThreads();
    };

    socket.onclose = () => {
      if (socket !== this.socket || this.manuallyClosed) {
        return;
      }
      this.socket = null;
      this.options.onConnectionState("disconnected");
    };

    socket.onmessage = (event: { data: string }) => {
      if (socket !== this.socket) {
        return;
      }
      let value: unknown;
      try {
        value = JSON.parse(event.data) as unknown;
      } catch {
        return;
      }

      if (isThreadNotification(value)) {
        if (!this.options.petId && value.type === "thread.listed") {
          this.historyPages = [...new Map([...this.historyPages, ...value.payload.threads].map(thread => [thread.id, thread])).values()];
          this.options.onNotification({...value,payload:{...value.payload,threads:this.historyPages}});
          if (value.payload.nextCursor) this.listThreads(value.payload.nextCursor);
          else this.loadingHistoryPages = false;
          return;
        }
        if (!this.options.petId && this.loadingHistoryPages && value.type === "thread.started") {
          this.historyPages.push({id:value.threadId,...value.payload,createdAt:value.payload.createdAt ?? value.timestamp,updatedAt:value.timestamp,messageCount:0,status:"idle"});
        }
        if (value.type === "thread.deleted") this.historyPages = this.historyPages.filter(thread => thread.id !== value.payload.targetThreadId);
        this.options.onNotification(value);
      } else if (isServerRequest(value)) {
        this.options.onRequest(value);
      }
    };
  }

  private hasActiveSocket(): boolean {
    return this.socket?.readyState === WS_CONNECTING || this.socket?.readyState === WS_OPEN;
  }

  private flushOutboundQueue(socket: WebSocketLike): void {
    while (this.outboundQueue.length > 0 && socket === this.socket && socket.readyState === WS_OPEN) {
      const message = this.outboundQueue.shift();
      if (message) {
        socket.send(message);
      }
    }
  }

  private now(): string {
    return (this.options.now ?? (() => new Date().toISOString()))();
  }

  private nextId(): string {
    return (this.options.id ?? (() => crypto.randomUUID()))();
  }
}
