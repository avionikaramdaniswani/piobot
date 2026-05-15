import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    botId: { type: mongoose.Schema.Types.ObjectId, ref: "Bot", required: true },
    plan: { type: String, enum: ["free", "basic", "premium"], default: "free" },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    features: { type: [String], default: [] },
  },
  { timestamps: true },
);

export interface ISubscription extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  botId: mongoose.Types.ObjectId;
  plan: "free" | "basic" | "premium";
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  features: string[];
}

export const Subscription = mongoose.model<ISubscription>("Subscription", subscriptionSchema);
