import { EventEmitter } from "events";

export type LogLevel = "info" | "success" | "error" | "warn" | "muted";

export interface BotLogEvent {
  botId: string;
  level: LogLevel;
  message: string;
  timestamp: string;
}

class BotLogEmitter extends EventEmitter {}

export const botLogEmitter = new BotLogEmitter();
botLogEmitter.setMaxListeners(200);

export function emitBotLog(botId: string, message: string, level: LogLevel = "info") {
  const event: BotLogEvent = {
    botId,
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  botLogEmitter.emit(`log:${botId}`, event);
}
