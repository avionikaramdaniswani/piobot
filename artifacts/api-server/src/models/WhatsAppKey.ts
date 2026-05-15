import mongoose from "mongoose";

const whatsAppKeySchema = new mongoose.Schema(
  {
    botId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bot",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
    },
    keyId: {
      type: String,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true },
);

whatsAppKeySchema.index({ botId: 1, type: 1, keyId: 1 }, { unique: true });

export interface IWhatsAppKey extends mongoose.Document {
  botId: mongoose.Types.ObjectId;
  type: string;
  keyId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const WhatsAppKey = mongoose.model<IWhatsAppKey>(
  "WhatsAppKey",
  whatsAppKeySchema,
);
