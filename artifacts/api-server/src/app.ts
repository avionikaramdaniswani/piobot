import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { connectDB } from "./config/db";
import { Bot } from "./models/Bot";
import { startWhatsAppBot } from "./lib/whatsapp";
import { scheduleNextReset, resetAllLimits } from "./lib/limitReset";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

async function reconnectActiveBots(): Promise<void> {
  const bots = await Bot.find({ status: { $in: ["connected", "connecting"] } });
  if (bots.length === 0) return;

  logger.info({ count: bots.length }, "Auto-reconnecting bots from previous session");

  for (const bot of bots) {
    const botId = bot._id.toString();
    await Bot.findByIdAndUpdate(botId, { status: "connecting" });
    startWhatsAppBot(botId).catch((err) => {
      logger.error({ err, botId }, "Failed to auto-reconnect bot");
    });
  }
}

// Global JSON error handler — ensures no route ever returns HTML on errors
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled route error");
  res.status(err?.status ?? 500).json({ error: err?.message ?? "Internal server error" });
});

connectDB()
  .then(async () => {
    await resetAllLimits();
    scheduleNextReset();
    await reconnectActiveBots();
  })
  .catch((err) => {
    logger.error({ err }, "Failed to connect to MongoDB");
    process.exit(1);
  });

export default app;
