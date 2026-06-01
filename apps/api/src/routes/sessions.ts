import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { generateSessionSecret, buildQrToken } from "../lib/totp";

const router = Router();

router.use(requireAuth);

const startSchema = z.object({
  courseId: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(20).max(500).optional(),
  intervalSeconds: z.number().min(10).max(60).optional(),
});

router.post("/", requireRole("LECTURER", "ADMIN"), async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні параметри сесії" });
    return;
  }

  const course = await prisma.course.findFirst({
    where: { id: parsed.data.courseId, lecturerId: req.auth!.userId },
  });
  if (!course) {
    res.status(404).json({ error: "Курс не знайдено" });
    return;
  }

  const active = await prisma.session.findFirst({
    where: { courseId: course.id, status: "ACTIVE" },
  });
  if (active) {
    res.status(409).json({ error: "Для цього курсу вже є активна сесія", sessionId: active.id });
    return;
  }

  const session = await prisma.session.create({
    data: {
      courseId: course.id,
      lecturerId: req.auth!.userId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      radiusMeters: parsed.data.radiusMeters ?? 80,
      intervalSeconds: parsed.data.intervalSeconds ?? 20,
      totpSecret: generateSessionSecret(),
    },
    include: { course: { select: { name: true, code: true } } },
  });

  res.status(201).json({ session });
});

router.get("/:sessionId", async (req, res) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.sessionId },
    include: {
      course: { select: { name: true, code: true, lecturerId: true } },
      _count: { select: { attendance: true } },
    },
  });
  if (!session) {
    res.status(404).json({ error: "Сесію не знайдено" });
    return;
  }

  const { role, userId } = req.auth!;
  const isLecturer = session.lecturerId === userId;
  const isEnrolled =
    role === "STUDENT" &&
    (await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: session.courseId } },
    }));

  if (!isLecturer && !isEnrolled && role !== "ADMIN") {
    res.status(403).json({ error: "Немає доступу до цієї сесії" });
    return;
  }

  res.json({ session });
});

router.get("/:sessionId/qr", async (req, res) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.sessionId },
  });
  if (!session || session.status !== "ACTIVE") {
    res.status(404).json({ error: "Активну сесію не знайдено" });
    return;
  }

  const { role, userId } = req.auth!;
  if (session.lecturerId !== userId && role !== "ADMIN") {
    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: session.courseId } },
    });
    if (!enrolled && role === "STUDENT") {
      res.status(403).json({ error: "Немає доступу" });
      return;
    }
  }

  const qr = buildQrToken(session.id, session.totpSecret, session.intervalSeconds);
  res.json({
    sessionId: session.id,
    token: qr.token,
    window: qr.window,
    expiresIn: qr.expiresIn,
    intervalSeconds: session.intervalSeconds,
  });
});

router.post("/:sessionId/close", requireRole("LECTURER", "ADMIN"), async (req, res) => {
  const session = await prisma.session.findFirst({
    where: { id: req.params.sessionId, lecturerId: req.auth!.userId },
  });
  if (!session) {
    res.status(404).json({ error: "Сесію не знайдено" });
    return;
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { status: "CLOSED", endedAt: new Date() },
  });
  res.json({ session: updated });
});

router.get("/:sessionId/attendance", async (req, res) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.sessionId },
    include: {
      course: true,
      attendance: {
        include: { user: { select: { id: true, fullName: true, email: true } } },
        orderBy: { scannedAt: "asc" },
      },
    },
  });
  if (!session) {
    res.status(404).json({ error: "Сесію не знайдено" });
    return;
  }

  const { role, userId } = req.auth!;
  if (session.lecturerId !== userId && role !== "ADMIN") {
    res.status(403).json({ error: "Лише викладач може переглядати список" });
    return;
  }

  const enrolled = await prisma.enrollment.findMany({
    where: { courseId: session.courseId },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });

  const presentIds = new Set(
    session.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").map((a) => a.userId)
  );

  res.json({
    session: {
      id: session.id,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      courseName: session.course.name,
    },
    present: session.attendance,
    absent: enrolled
      .map((e) => e.user)
      .filter((u) => !presentIds.has(u.id)),
  });
});

router.get("/:sessionId/report.csv", async (req, res) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.sessionId },
    include: {
      course: true,
      attendance: {
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { scannedAt: "asc" },
      },
    },
  });
  if (!session) {
    res.status(404).json({ error: "Сесію не знайдено" });
    return;
  }

  if (session.lecturerId !== req.auth!.userId && req.auth!.role !== "ADMIN") {
    res.status(403).json({ error: "Немає доступу до звіту" });
    return;
  }

  const enrolled = await prisma.enrollment.findMany({
    where: { courseId: session.courseId },
    include: { user: { select: { fullName: true, email: true } } },
  });

  const presentMap = new Map(
    session.attendance.map((a) => [a.user.email, a])
  );

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    "ПІБ,Email,Статус,Час сканування,Відстань (м)",
  ];

  for (const e of enrolled) {
    const att = presentMap.get(e.user.email);
    const status = att
      ? att.status === "LATE"
        ? "Запізнення"
        : att.status === "PRESENT"
          ? "Присутній"
          : "Відхилено"
      : "Відсутній";
    const time = att ? att.scannedAt.toISOString() : "";
    const dist = att?.distanceMeters != null ? String(Math.round(att.distanceMeters)) : "";
    lines.push(
      [e.user.fullName, e.user.email, status, time, dist].map(escape).join(",")
    );
  }

  const bom = "\uFEFF";
  const filename = `vidviduvannist-${session.course.name.replace(/\s+/g, "_")}-${session.startedAt.toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(bom + lines.join("\n"));
});

router.get("/course/:courseId", async (req, res) => {
  const course = await prisma.course.findFirst({
    where: { id: req.params.courseId, lecturerId: req.auth!.userId },
  });
  if (!course) {
    res.status(404).json({ error: "Курс не знайдено" });
    return;
  }

  const sessions = await prisma.session.findMany({
    where: { courseId: course.id },
    orderBy: { startedAt: "desc" },
    include: { _count: { select: { attendance: true } } },
  });
  res.json({ sessions });
});

export default router;
