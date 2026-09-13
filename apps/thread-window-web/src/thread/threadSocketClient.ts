import {
  encodeThreadList,
  encodeThreadResume,
  encodeOpSubmit,
  encodeWorkspaceList,
  type RuntimeOp,
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

  constructor(private readonly options: {
    url: string;
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

  listThreads(): void {
    this.sendRaw(encodeThreadList({
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
      this.sendRaw(encodeWorkspaceList({
        commandId: this.nextId(),
        timestamp: this.now(),
      }));
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
