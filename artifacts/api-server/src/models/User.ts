import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true },
);

export interface IUser extends mongoose.Document {
  username: string;
  email: string;
  password: string;
  role: "user" | "admin";
  createdAt: Date;
}

export const User = mongoose.model<IUser>("User", userSchema);
