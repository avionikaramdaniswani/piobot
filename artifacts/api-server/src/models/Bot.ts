import mongoose from "mongoose";

const ownerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
  },
  { _id: false },
);

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
    prefixes: { type: [String], default: [] },
    owners: { type: [ownerSchema], default: [] },
    connectedAt: { type: Date, default: null },
    commands: { type: Map, of: Boolean, default: {} },
  },
  { timestamps: true },
);

export interface IBotOwner {
  name: string;
  phoneNumber: string;
}

export interface IBot extends mongoose.Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  phoneNumber: string | null;
  status: "inactive" | "connecting" | "connected" | "disconnected";
  prefix: string;
  prefixes: string[];
  owners: IBotOwner[];
  connectedAt: Date | null;
  createdAt: Date;
  commands: Map<string, boolean>;
}

export const Bot = mongoose.model<IBot>("Bot", botSchema);
