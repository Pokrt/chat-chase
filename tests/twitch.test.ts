import { it, expect, vi, afterEach } from "vitest";
import { Twitch, authenticate, login } from "../src/twitch";
class Socket {
  static all: Socket[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    Socket.all.push(this);
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
  async send(type: string, payload: any, id = "event-1") {
    await this.onmessage?.({
      data: JSON.stringify({
        metadata: { message_type: type, message_id: id },
        payload,
      }),
    });
  }
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Socket.all = [];
});
it("subscribes all five types, survives individual subscription failure, deduplicates notifications, transfers sessions", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, status: 202, text: async () => "" });
  fetcher.mockResolvedValueOnce({
    ok: false,
    status: 403,
    text: async () => "not affiliated",
  });
  vi.stubGlobal("fetch", fetcher);
  const receive = vi.fn(),
    log = vi.fn();
  const t = new Twitch(
    "token",
    { user_id: "123", login: "runner", client_id: "app", expires_in: 3600 },
    receive,
    log,
  );
  t.connect();
  const a = Socket.all[0];
  await a.send("session_welcome", {
    session: { id: "s1", keepalive_timeout_seconds: 10 },
  });
  expect(fetcher).toHaveBeenCalledTimes(5);
  expect(log.mock.calls.some((x) => x[0].includes("403"))).toBe(true);
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.condition).toEqual({
    broadcaster_user_id: "123",
    user_id: "123",
  });
  expect(body.transport).toEqual({ method: "websocket", session_id: "s1" });
  const notification = {
    subscription: { type: "channel.chat.message" },
    event: {
      chatter_user_id: "u",
      chatter_user_name: "fan",
      message: { text: "!wall" },
    },
  };
  await a.send("notification", notification);
  await a.send("notification", notification);
  expect(receive).toHaveBeenCalledTimes(1);
  await a.send("revocation", {
    subscription: { type: "channel.cheer", status: "authorization_revoked" },
  });
  expect(log).toHaveBeenCalledWith(
    "Subscription revoked: channel.cheer (authorization_revoked)",
  );
  await a.send("session_reconnect", {
    session: { reconnect_url: "wss://eventsub.wss.twitch.tv/reconnect" },
  });
  const b = Socket.all[1];
  expect(a.closed).toBe(false);
  await b.send("session_welcome", {
    session: { id: "s2", keepalive_timeout_seconds: 10 },
  });
  expect(a.closed).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(5);
  t.close();
  expect(b.closed).toBe(true);
});
it("watchdog closes a silent socket and retries", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  const t = new Twitch(
    "token",
    { user_id: "1", login: "a", client_id: "c", expires_in: 3600 },
    vi.fn(),
    vi.fn(),
  );
  t.connect();
  const a = Socket.all[0];
  await a.send("session_welcome", {
    session: { id: "s", keepalive_timeout_seconds: 10 },
  });
  await vi.advanceTimersByTimeAsync(16001);
  expect(a.closed).toBe(true);
  expect(Socket.all).toHaveLength(2);
  t.close();
});
it("batches output and respects the 5 second posting interval", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(10000);
  const f = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", f);
  const t = new Twitch(
    "token",
    { user_id: "1", login: "a", client_id: "c", expires_in: 3600 },
    vi.fn(),
    vi.fn(),
  );
  t.say("one");
  t.say("two");
  await t.flush();
  expect(JSON.parse(f.mock.calls[0][1].body).message).toBe("one · two");
  t.say("three");
  await t.flush();
  expect(f).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5000);
  expect(f).toHaveBeenCalledTimes(2);
  t.close();
});
it("rejects OAuth state mismatch and clears token from URL", async () => {
  const values = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => values.get(k),
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
  vi.stubGlobal("location", {
    hash: "#access_token=secret&state=bad",
    pathname: "/",
    search: "",
    origin: "http://localhost",
  });
  const replaceState = vi.fn();
  vi.stubGlobal("history", { replaceState });
  await expect(authenticate()).rejects.toThrow("state did not match");
  expect(replaceState).toHaveBeenCalledWith(null, "", "/");
  expect(values.has("cc.token")).toBe(false);
});
