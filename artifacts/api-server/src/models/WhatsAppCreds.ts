import mongoose from "mongoose";

const whatsAppCredsSchema = new mongoose.Schema(
  {
    botId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bot",
      required: true,
      unique: true,
      index: true,
    },
    creds: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true },
);

export interface IWhatsAppCreds extends mongoose.Document {
  botId: mongoose.Types.ObjectId;
  creds: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const WhatsAppCreds = mongoose.model<IWhatsAppCreds>(
  "WhatsAppCreds",
  whatsAppCredsSchema,
);
