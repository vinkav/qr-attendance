import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);
router.use(requireRole("ADMIN"));

router.get("/stats", async (_req, res) => {
  const [users, courses, sessions, attendance] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.course.count(),
    prisma.session.count(),
    prisma.attendance.count({ where: { status: { in: ["PRESENT", "LATE"] } } }),
  ]);

  const byRole = Object.fromEntries(users.map((u) => [u.role, u._count]));
  res.json({
    stats: {
      students: byRole.STUDENT ?? 0,
      lecturers: byRole.LECTURER ?? 0,
      admins: byRole.ADMIN ?? 0,
      courses,
      sessions,
      attendanceRecords: attendance,
    },
  });
});

router.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      deviceHash: true,
      createdAt: true,
      _count: { select: { enrollments: true, courses: true } },
    },
  });
  res.json({ users });
});

router.get("/courses", async (_req, res) => {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      lecturer: { select: { fullName: true, email: true } },
      _count: { select: { enrollments: true, sessions: true } },
    },
  });
  res.json({ courses });
});

router.patch("/users/:userId", async (req, res) => {
  const schema = z.object({
    email: z.string().email("Невірний email").optional(),
    password: z.string().min(6, "Пароль має бути щонайменше 6 символів").optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Невірні дані" });
    return;
  }

  const { email, password } = parsed.data;
  if (!email && !password) {
    res.status(400).json({ error: "Вкажіть email або новий пароль" });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target) {
    res.status(404).json({ error: "Користувача не знайдено" });
    return;
  }

  if (email && email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Користувач з таким email вже існує" });
      return;
    }
  }

  const data: { email?: string; passwordHash?: string } = {};
  if (email) data.email = email;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id: target.id },
    data,
    select: { id: true, email: true, fullName: true, role: true },
  });
  res.json({ user });
});

router.patch("/users/:userId/role", async (req, res) => {
  const schema = z.object({ role: z.enum(["STUDENT", "LECTURER", "ADMIN"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірна роль" });
    return;
  }

  if (req.params.userId === req.auth!.userId && parsed.data.role !== "ADMIN") {
    res.status(400).json({ error: "Не можна зняти роль адміністратора з себе" });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.params.userId },
    data: { role: parsed.data.role as Role },
    select: { id: true, email: true, fullName: true, role: true },
  });
  res.json({ user });
});

router.post("/users/:userId/reset-device", async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target) {
    res.status(404).json({ error: "Користувача не знайдено" });
    return;
  }
  if (target.role !== "STUDENT") {
    res.status(400).json({ error: "Скидання пристрою лише для студентів" });
    return;
  }
  await prisma.user.update({
    where: { id: target.id },
    data: { deviceHash: null },
  });
  res.json({ message: "Прив'язку пристрою скинуто" });
});

router.delete("/courses/:courseId", async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
  if (!course) {
    res.status(404).json({ error: "Курс не знайдено" });
    return;
  }
  await prisma.course.delete({ where: { id: course.id } });
  res.json({ message: "Курс видалено" });
});

export default router;
