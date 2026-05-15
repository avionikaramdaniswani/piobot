import mongoose from "mongoose";

const ownerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const filterRuleSchema = new mongoose.Schema(
  {
    command: { type: String, required: true },
    scope: { type: String, enum: ["group", "private", "number"], required: true },
    target: { type: String, default: "" },
    targetLabel: { type: String, default: "" },
    action: { type: String, enum: ["block"], default: "block" },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
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
    filterRules: { type: [filterRuleSchema], default: [] },
    connectedAt: { type: Date, default: null },
    commands: { type: Map, of: Boolean, default: {} },
  },
  { timestamps: true },
);

export interface IBotOwner {
  name: string;
  phoneNumber: string;
}

export interface IFilterRule extends mongoose.Document {
  command: string;
  scope: "group" | "private" | "number";
  target: string;
  targetLabel: string;
  action: "block";
  enabled: boolean;
  createdAt: Date;
}

export interface IBot extends mongoose.Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  phoneNumber: string | null;
  status: "inactive" | "connecting" | "connected" | "disconnected";
  prefix: string;
  prefixes: string[];
  owners: IBotOwner[];
  filterRules: IFilterRule[];
  connectedAt: Date | null;
  createdAt: Date;
  commands: Map<string, boolean>;
}

export const Bot = mongoose.model<IBot>("Bot", botSchema);
