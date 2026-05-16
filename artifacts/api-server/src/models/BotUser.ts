import mongoose from "mongoose";

const botUserSchema = new mongoose.Schema(
  {
    botId: { type: mongoose.Schema.Types.ObjectId, ref: "Bot", required: true },
    senderJid: { type: String, required: true, trim: true },
    phoneNumber: { type: String, default: "" }, // nomor telepon international tanpa + (misal: 6285709557572)
    displayName: { type: String, default: "" },
    balance: { type: Number, default: 0, min: 0 },
    limit: { type: Number, default: 25, min: 0 },
    limitResetAt: { type: Date, default: null },
    totalCommandsUsed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

botUserSchema.index({ botId: 1, senderJid: 1 }, { unique: true });

export interface IBotUser extends mongoose.Document {
  botId: mongoose.Types.ObjectId;
  senderJid: string;
  phoneNumber: string;
  displayName: string;
  balance: number;
  limit: number;
  limitResetAt: Date | null;
  totalCommandsUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

export const BotUser = mongoose.model<IBotUser>("BotUser", botUserSchema);
