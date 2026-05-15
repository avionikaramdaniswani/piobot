import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { connectDB } from "./config/db";
import { Bot } from "./models/Bot";
import { startWhatsAppBot } from "./lib/whatsapp";

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

connectDB()
  .then(() => reconnectActiveBots())
  .catch((err) => {
    logger.error({ err }, "Failed to connect to MongoDB");
    process.exit(1);
  });

export default app;
