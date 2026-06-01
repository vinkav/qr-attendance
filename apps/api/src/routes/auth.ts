import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, signToken } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  email: z.string().email("Невірний email"),
  password: z.string().min(6, "Пароль має бути щонайменше 6 символів"),
  fullName: z.string().min(2, "Вкажіть ПІБ"),
  role: z.enum(["STUDENT", "LECTURER"]).default("STUDENT"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Невірні дані" });
    return;
  }

  const { email, password, fullName, role } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Користувач з таким email вже існує" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName, role: role as Role },
  });

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні дані для входу" });
    return;
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Невірний email або пароль" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      deviceHash: user.deviceHash,
    },
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { id: true, email: true, fullName: true, role: true, deviceHash: true },
  });
  if (!user) {
    res.status(404).json({ error: "Користувача не знайдено" });
    return;
  }
  res.json({ user });
});

router.patch("/me", requireAuth, async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2).optional(),
    password: z.string().min(6).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні дані профілю" });
    return;
  }

  const data: { fullName?: string; passwordHash?: string } = {};
  if (parsed.data.fullName) data.fullName = parsed.data.fullName;
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "Немає даних для оновлення" });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.auth!.userId },
    data,
    select: { id: true, email: true, fullName: true, role: true, deviceHash: true },
  });
  res.json({ user });
});

router.post("/device", requireAuth, async (req, res) => {
  const schema = z.object({ deviceHash: z.string().min(8).max(128) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірний ідентифікатор пристрою" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) {
    res.status(404).json({ error: "Користувача не знайдено" });
    return;
  }

  if (user.deviceHash && user.deviceHash !== parsed.data.deviceHash) {
    res.status(403).json({
      error: "Обліковий запис прив'язано до іншого пристрою. Зверніться до адміністратора.",
    });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { deviceHash: parsed.data.deviceHash },
    select: { id: true, deviceHash: true },
  });
  res.json({ user: updated, message: "Пристрій успішно прив'язано" });
});

export default router;
