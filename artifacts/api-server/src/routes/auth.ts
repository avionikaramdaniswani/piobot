import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, type IUser } from "../models/User";
import { Bot } from "../models/Bot";
import { Subscription } from "../models/Subscription";
import { RegisterBody, LoginBody, RefreshTokenBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function signTokens(userId: string, role: string) {
  const secret = process.env.JWT_SECRET!;
  const refreshSecret = process.env.JWT_REFRESH_SECRET!;
  const accessToken = jwt.sign({ userId, role }, secret, {
    expiresIn: (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) ?? "1d",
  });
  const refreshToken = jwt.sign({ userId, role }, refreshSecret, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"]) ?? "7d",
  });
  return { accessToken, refreshToken };
}

function formatUser(user: IUser) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, email, password } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(400).json({ error: "Email sudah terdaftar" });
    return;
  }

  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    res.status(400).json({ error: "Username sudah digunakan" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({ username, email, password: hashedPassword });

  const bot = await Bot.create({
    ownerId: user._id,
    name: username,
    prefix: ".",
  });

  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 99);
  await Subscription.create({
    userId: user._id,
    botId: bot._id,
    plan: "free",
    startDate: new Date(),
    endDate,
    isActive: true,
    features: ["ping", "menu", "info"],
  });

  const tokens = signTokens(user._id.toString(), user.role);
  res.status(201).json({ ...tokens, user: formatUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const user = await User.findOne({ email });
  if (!user) {
    res.status(401).json({ error: "Email atau kata sandi salah" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Email atau kata sandi salah" });
    return;
  }

  const tokens = signTokens(user._id.toString(), user.role);
  res.json({ ...tokens, user: formatUser(user) });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const parsed = RefreshTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { refreshToken } = parsed.data;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) {
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, refreshSecret) as { userId: string; role: string };
    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    const tokens = signTokens(user._id.toString(), user.role);
    res.json({ ...tokens, user: formatUser(user) });
  } catch {
    res.status(401).json({ error: "Token tidak valid atau sudah kadaluarsa" });
  }
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = await User.findById(req.user!.userId);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(user));
});

export default router;
