import mongoose from "mongoose";

const botSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, default: null },
    status: {
      type: String,
      enum: ["inactive", "connecting", "connected", "disconnected"],
      default: "inactive",
    },
    prefix: { type: String, default: "." },
    connectedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export interface IBot extends mongoose.Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  phoneNumber: string | null;
  status: "inactive" | "connecting" | "connected" | "disconnected";
  prefix: string;
  connectedAt: Date | null;
  createdAt: Date;
}

export const Bot = mongoose.model<IBot>("Bot", botSchema);
