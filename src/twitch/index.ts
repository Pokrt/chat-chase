import type { SourceEvent } from "../effects";
const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID || "";
const redirect = () =>
  import.meta.env.VITE_TWITCH_REDIRECT_URI || location.origin + "/";
const scopes =
  "user:read:chat user:write:chat bits:read channel:read:subscriptions channel:read:redemptions";
export interface Identity {
  user_id: string;
  login: string;
  client_id: string;
  expires_in: number;
}
export function login() {
  if (!clientId)
    throw Error("Add your Twitch client ID to .env, then restart the app.");
  const state = crypto.randomUUID();
  sessionStorage.setItem("cc.oauth.state", state);
  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.search = new URLSearchParams({
    response_type: "token",
    client_id: clientId,
    redirect_uri: redirect(),
    scope: scopes,
    state,
  }).toString();
  location.assign(url);
}
export async function authenticate(): Promise<{
  token: string;
  identity: Identity;
} | null> {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has("error")) {
    history.replaceState(null, "", location.pathname + location.search);
    throw Error(
      "Twitch sign-in was declined. You can keep playing in demo mode.",
    );
  }
  const incoming = hash.get("access_token");
  if (incoming) {
    const expected = sessionStorage.getItem("cc.oauth.state");
    history.replaceState(null, "", location.pathname + location.search);
    sessionStorage.removeItem("cc.oauth.state");
    if (!expected || hash.get("state") !== expected)
      throw Error("Twitch sign-in state did not match. Please connect again.");
    sessionStorage.setItem("cc.token", incoming);
  }
  const token = sessionStorage.getItem("cc.token");
  if (!token) return null;
  const r = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${token}` },
  });
  if (!r.ok) {
    sessionStorage.removeItem("cc.token");
    throw Error("Twitch session expired. Please connect again.");
  }
  const identity = (await r.json()) as Identity;
  if (identity.client_id !== clientId) {
    sessionStorage.removeItem("cc.token");
    throw Error("Token belongs to a different Twitch app. Connect again.");
  }
  return { token, identity };
}
export function mapNotification(
  type: string,
  e: Record<string, any>,
): SourceEvent | null {
  const base = {
    id: String(e.chatter_user_id || e.user_id || "anonymous"),
    name: String(e.chatter_user_name || e.user_name || "Anonymous"),
  };
  if (type === "channel.chat.message")
    return {
      ...base,
      type: "chat",
      text: e.message?.text || "",
      privileged: e.badges?.some((b: { set_id: string }) =>
        ["subscriber", "vip", "moderator", "broadcaster"].includes(b.set_id),
      ),
    };
  if (type === "channel.cheer") return { ...base, type: "cheer", bits: e.bits };
  if (type === "channel.subscribe")
    return e.is_gift ? null : { ...base, type: "sub" };
  if (type === "channel.subscription.gift") return { ...base, type: "gift" };
  if (type === "channel.channel_points_custom_reward_redemption.add")
    return { ...base, type: "redemption", reward: e.reward?.title };
  return null;
}
export class Twitch {
  socket: WebSocket | null = null;
  watchdog: ReturnType<typeof setTimeout> | undefined;
  retry: ReturnType<typeof setTimeout> | undefined;
  seen = new Set<string>();
  closed = false;
  backoff = 1000;
  chatQueue: string[] = [];
  chatTimer: ReturnType<typeof setInterval>;
  lastSend = 0;
  constructor(
    public token: string,
    public identity: Identity,
    private event: (e: SourceEvent) => void,
    private log: (s: string) => void,
    public output = true,
  ) {
    this.chatTimer = setInterval(() => void this.flush(), 1000);
  }
  headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      "Client-Id": clientId || this.identity.client_id,
      "Content-Type": "application/json",
    };
  }
  connect(
    url = import.meta.env.VITE_TWITCH_WS_URL ||
      "wss://eventsub.wss.twitch.tv/ws",
    transfer = false,
  ) {
    if (this.closed) return;
    const old = this.socket;
    const ws = new WebSocket(url);
    if (!transfer) this.socket = ws;
    let timeout = 15;
    let welcomed = false;
    const arm = () => {
      clearTimeout(this.watchdog);
      this.watchdog = setTimeout(
        () => {
          this.log("Twitch quiet too long — reconnecting");
          ws.close();
        },
        (timeout + 5) * 1000,
      );
    };
    ws.onopen = arm;
    ws.onmessage = async (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        this.log("Ignored malformed Twitch message");
        return;
      }
      const type = m.metadata?.message_type;
      const p = m.payload;
      arm();
      if (type === "session_welcome") {
        welcomed = true;
        this.backoff = 1000;
        timeout = p.session.keepalive_timeout_seconds || 15;
        if (transfer) {
          this.socket = ws;
          if (old) {
            old.onclose = null;
            old.close();
          }
        }
        this.log("Twitch connected");
        if (!transfer) await this.subscribe(p.session.id);
        arm();
      }
      if (type === "session_reconnect") {
        clearTimeout(this.watchdog);
        this.connect(p.session.reconnect_url, true);
      }
      if (type === "revocation")
        this.log(
          `Subscription revoked: ${p.subscription.type} (${p.subscription.status})`,
        );
      if (type === "notification") {
        const id = m.metadata.message_id;
        if (this.seen.has(id)) return;
        this.seen.add(id);
        if (this.seen.size > 2000)
          this.seen.delete(this.seen.values().next().value!);
        const e = mapNotification(p.subscription.type, p.event);
        if (e) this.event(e);
      }
    };
    ws.onerror = () =>
      this.log("Twitch socket error; check connection or mock server");
    ws.onclose = () => {
      if (this.closed) return;
      if (transfer && !welcomed) {
        this.log("Twitch transfer failed; reconnecting normally");
      } else if (this.socket !== ws) return;
      clearTimeout(this.watchdog);
      this.log("Twitch disconnected — retrying");
      this.retry = setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(30000, this.backoff * 2);
    };
  }
  async subscribe(session: string) {
    await Promise.all(
      [
        "channel.chat.message",
        "channel.cheer",
        "channel.subscribe",
        "channel.subscription.gift",
        "channel.channel_points_custom_reward_redemption.add",
      ].map(async (type) => {
        try {
          const condition: Record<string, string> = {
            broadcaster_user_id: this.identity.user_id,
          };
          if (type === "channel.chat.message")
            condition.user_id = this.identity.user_id;
          const r = await fetch(
            import.meta.env.VITE_TWITCH_SUBSCRIPTIONS_URL ||
              "https://api.twitch.tv/helix/eventsub/subscriptions",
            {
              method: "POST",
              headers: this.headers(),
              body: JSON.stringify({
                type,
                version: "1",
                condition,
                transport: { method: "websocket", session_id: session },
              }),
            },
          );
          this.log(
            `${type}: ${r.ok ? "subscribed" : `${r.status} ${await r.text()}`}`,
          );
        } catch (e) {
          this.log(`${type}: ${String(e)}`);
        }
      }),
    );
  }
  say(message: string) {
    if (this.output && this.chatQueue.length < 12)
      this.chatQueue.push(message.slice(0, 480));
  }
  async flush() {
    if (!this.output) {
      this.chatQueue = [];
      return;
    }
    if (!this.chatQueue.length || Date.now() - this.lastSend < 5000) return;
    const message = this.chatQueue.splice(0, 3).join(" · ");
    this.lastSend = Date.now();
    try {
      const r = await fetch("https://api.twitch.tv/helix/chat/messages", {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          broadcaster_id: this.identity.user_id,
          sender_id: this.identity.user_id,
          message,
        }),
      });
      if (!r.ok) this.log(`Chat output failed (${r.status})`);
    } catch {
      this.log("Could not send chat message");
    }
  }
  close() {
    this.closed = true;
    clearTimeout(this.watchdog);
    clearTimeout(this.retry);
    clearInterval(this.chatTimer);
    this.socket?.close();
  }
}
