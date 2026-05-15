import mongoose from "mongoose";

const botMessagesSchema = new mongoose.Schema(
  {
    botId: { type: mongoose.Schema.Types.ObjectId, ref: "Bot", required: true, unique: true },
    messages: { type: Map, of: String, default: {} },
  },
  { timestamps: true },
);

export interface IBotMessages extends mongoose.Document {
  botId: mongoose.Types.ObjectId;
  messages: Map<string, string>;
}

export const BotMessages = mongoose.model<IBotMessages>("BotMessages", botMessagesSchema);
