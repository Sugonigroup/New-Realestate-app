import type { Channel } from "./consent.js";

/** Provider-agnostic outbound message (05 §1: all sends go through the hub, never direct). */
export interface OutboundMessage {
  channel: Channel;
  toAddress: string; // phone (whatsapp/sms) or email
  body: string;
  subject?: string; // email
  templateKey?: string;
  category?: "utility" | "marketing" | "authentication";
  correlationId?: string;
}

export interface ProviderResult {
  providerId: string;
  status: "sent" | "failed";
  failureReason?: string;
}

export const NOTIFY_PORT = "NotificationPort";

export interface NotificationPort {
  readonly name: string;
  readonly supports: Channel[];
  send(msg: OutboundMessage): Promise<ProviderResult>;
}

/** Phase 0 adapter: records locally so flows are testable without provider creds. */
export class ConsoleNotificationAdapter implements NotificationPort {
  readonly name = "console";
  readonly supports: Channel[] = ["whatsapp", "email", "sms"];

  async send(msg: OutboundMessage): Promise<ProviderResult> {
    // eslint-disable-next-line no-console
    console.log(
      `[notify:${this.name}] ${msg.channel} → ${msg.toAddress} (${msg.templateKey ?? "raw"}): ${msg.body.slice(0, 120)}`,
    );
    return { providerId: `console-${Date.now()}`, status: "sent" };
  }
}
