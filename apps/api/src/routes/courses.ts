import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getCourseIfAllowed } from "../lib/courseAccess";
import { requireAuth, requireRole } from "../middleware/auth";
import { generateEnrollCode, parseEmailList } from "../lib/enrollCode";
import { buildCoursePeriodCsv } from "../lib/courseReport";

const router = Router();

router.use(requireAuth);

async function uniqueEnrollCode(): Promise<string> {
  for (let i = 0; i < 15; i++) {
    const code = generateEnrollCode();
    const existing = await prisma.course.findUnique({ where: { enrollCode: code } });
    if (!existing) return code;
  }
  throw new Error("Не вдалося згенерувати код курсу");
}

router.get("/", async (req, res) => {
  const { role, userId } = req.auth!;

  if (role === "LECTURER") {
    const courses = await prisma.course.findMany({
      where: { lecturerId: userId },
      include: { _count: { select: { enrollments: true, sessions: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ courses });
    return;
  }

  if (role === "ADMIN") {
    const courses = await prisma.course.findMany({
      include: {
        lecturer: { select: { fullName: true } },
        _count: { select: { enrollments: true, sessions: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ courses });
    return;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      course: {
        include: { lecturer: { select: { fullName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    courses: enrollments.map((e) => ({
      ...e.course,
      lecturerName: e.course.lecturer.fullName,
    })),
  });
});

router.post("/join", requireRole("STUDENT"), async (req, res) => {
  const schema = z.object({
    enrollCode: z.string().min(4).max(12).transform((s) => s.trim().toUpperCase()),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Вкажіть код курсу" });
    return;
  }

  const course = await prisma.course.findUnique({
    where: { enrollCode: parsed.data.enrollCode },
  });
  if (!course || !course.enrollCode) {
    res.status(404).json({ error: "Курс з таким кодом не знайдено" });
    return;
  }

  const enrollment = await prisma.enrollment.upsert({
    where: {
      userId_courseId: { userId: req.auth!.userId, courseId: course.id },
    },
    create: { userId: req.auth!.userId, courseId: course.id },
    update: {},
    include: { course: { select: { id: true, name: true, code: true, enrollCode: true } } },
  });

  res.status(201).json({
    message: `Ви записані на курс «${course.name}»`,
    enrollment,
  });
});

router.post("/", requireRole("LECTURER", "ADMIN"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    code: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Вкажіть назву курсу" });
    return;
  }

  const course = await prisma.course.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
      enrollCode: await uniqueEnrollCode(),
      lecturerId: req.auth!.userId,
    },
  });
  res.status(201).json({ course });
});

router.get("/:courseId/report.csv", requireRole("LECTURER", "ADMIN"), async (req, res) => {
  const course = await getCourseIfAllowed(
    req.params.courseId,
    req.auth!.userId,
    req.auth!.role
  );
  if (!course) {
    res.status(404).json({ error: "Курс не знайдено" });
    return;
  }

  const fromQ = typeof req.query.from === "string" ? req.query.from : undefined;
  const toQ = typeof req.query.to === "string" ? req.query.to : undefined;
  const now = new Date();
  const from = fromQ ? new Date(fromQ) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const to = toQ ? new Date(toQ) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    res.status(400).json({ error: "Невірний формат дат (from, to)" });
    return;
  }
  to.setHours(23, 59, 59, 999);

  const [sessions, enrolled, attendance] = await Promise.all([
    prisma.session.findMany({
      where: { courseId: course.id, startedAt: { gte: from, lte: to } },
      orderBy: { startedAt: "asc" },
      select: { id: true, startedAt: true },
    }),
    prisma.enrollment.findMany({
      where: { courseId: course.id },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        session: { courseId: course.id, startedAt: { gte: from, lte: to } },
        status: { in: ["PRESENT", "LATE"] },
      },
      include: { user: { select: { email: true } } },
    }),
  ]);

  const full = await prisma.course.findUnique({ where: { id: course.id }, select: { name: true } });
  const csv = buildCoursePeriodCsv(
    full!.name,
    sessions,
    enrolled.map((e) => e.user),
    attendance.map((a) => ({ status: a.status, user: a.user, sessionId: a.sessionId }))
  );

  const asciiName = `course-report-${from.toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"`);
  res.send(csv);
});

router.get("/:courseId", requireRole("LECTURER", "ADMIN"), async (req, res) => {
  const course = await getCourseIfAllowed(
    req.params.courseId,
    req.auth!.userId,
    req.auth!.role
  );
  if (!course) {
    res.status(404).json({ error: "Курс не знайдено" });
    return;
  }

  const full = await prisma.course.findUnique({
    where: { id: course.id },
    include: {
      lecturer: { select: { fullName: true, email: true } },
      _count: { select: { enrollments: true, sessions: true } },
    },
  });
  res.json({ course: full });
});

router.delete("/:courseId", requireRole("LECTURER", "ADMIN"), async (req, res) => {
  const course = await getCourseIfAllowed(
    req.params.courseId,
    req.auth!.userId,
    req.auth!.role
  );
  if (!course) {
    res.status(404).json({ error: "Курс не знайдено" });
    return;
  }

  await prisma.course.delete({ where: { id: course.id } });
  res.json({ message: "Курс видалено" });
});

router.post(
  "/:courseId/enroll-code/regenerate",
  requireRole("LECTURER", "ADMIN"),
  async (req, res) => {
    const course = await getCourseIfAllowed(
      req.params.courseId,
      req.auth!.userId,
      req.auth!.role
    );
    if (!course) {
      res.status(404).json({ error: "Курс не знайдено" });
      return;
    }

    const updated = await prisma.course.update({
      where: { id: course.id },
      data: { enrollCode: await uniqueEnrollCode() },
      select: { id: true, name: true, enrollCode: true },
    });
    res.json({ course: updated });
  }
);

router.post("/:courseId/enroll", requireRole("LECTURER", "ADMIN"), async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Вкажіть email студента" });
    return;
  }

  const course = await getCourseIfAllowed(
    req.params.courseId,
    req.auth!.userId,
    req.auth!.role
  );
  if (!course) {
    res.status(404).json({ error: "Курс не знайдено" });
    return;
  }

  const student = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!student || student.role !== "STUDENT") {
    res.status(404).json({ error: "Студента з таким email не знайдено" });
    return;
  }

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    create: { userId: student.id, courseId: course.id },
    update: {},
    include: { user: { select: { id: true, email: true, fullName: true } } },
  });
  res.status(201).json({ enrollment });
});

router.post("/:courseId/enroll/bulk", requireRole("LECTURER", "ADMIN"), async (req, res) => {
  const schema = z.object({
    emails: z.array(z.string().email()).optional(),
    text: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірний список email" });
    return;
  }

  const emailList = [
    ...(parsed.data.emails ?? []),
    ...parseEmailList(parsed.data.text ?? ""),
  ];
  const uniqueEmails = [...new Set(emailList.map((e) => e.toLowerCase()))];

  if (uniqueEmails.length === 0) {
    res.status(400).json({ error: "Вкажіть хоча б один email (по рядку або через кому)" });
    return;
  }

  const course = await getCourseIfAllowed(
    req.params.courseId,
    req.auth!.userId,
    req.auth!.role
  );
  if (!course) {
    res.status(404).json({ error: "Курс не знайдено" });
    return;
  }

  const added: string[] = [];
  const notFound: string[] = [];
  const skipped: string[] = [];

  for (const email of uniqueEmails) {
    const student = await prisma.user.findUnique({ where: { email } });
    if (!student || student.role !== "STUDENT") {
      notFound.push(email);
      continue;
    }
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: student.id, courseId: course.id } },
    });
    if (existing) {
      skipped.push(email);
      continue;
    }
    await prisma.enrollment.create({
      data: { userId: student.id, courseId: course.id },
    });
    added.push(email);
  }

  res.status(201).json({
    added: added.length,
    skipped: skipped.length,
    notFound,
    message: `Додано ${added.length} студентів`,
  });
});

router.delete(
  "/:courseId/students/:studentId",
  requireRole("LECTURER", "ADMIN"),
  async (req, res) => {
    const course = await getCourseIfAllowed(
      req.params.courseId,
      req.auth!.userId,
      req.auth!.role
    );
    if (!course) {
      res.status(404).json({ error: "Курс не знайдено" });
      return;
    }

    const result = await prisma.enrollment.deleteMany({
      where: { courseId: course.id, userId: req.params.studentId },
    });
    if (result.count === 0) {
      res.status(404).json({ error: "Студента не знайдено на курсі" });
      return;
    }
    res.json({ message: "Студента видалено з курсу" });
  }
);

router.post(
  "/:courseId/students/:studentId/reset-device",
  requireRole("LECTURER", "ADMIN"),
  async (req, res) => {
    const course = await getCourseIfAllowed(
      req.params.courseId,
      req.auth!.userId,
      req.auth!.role
    );
    if (!course) {
      res.status(404).json({ error: "Курс не знайдено" });
      return;
    }

    const enrolled = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId: req.params.studentId, courseId: course.id },
      },
    });
    if (!enrolled) {
      res.status(404).json({ error: "Студент не записаний на цей курс" });
      return;
    }

    await prisma.user.update({
      where: { id: req.params.studentId },
      data: { deviceHash: null },
    });
    res.json({ message: "Прив'язку пристрою скинуто" });
  }
);

router.get("/:courseId/students", requireRole("LECTURER", "ADMIN"), async (req, res) => {
  const course = await getCourseIfAllowed(
    req.params.courseId,
    req.auth!.userId,
    req.auth!.role
  );
  if (!course) {
    res.status(404).json({ error: "Курс не знайдено" });
    return;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: course.id },
    include: {
      user: { select: { id: true, email: true, fullName: true, deviceHash: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json({
    students: enrollments.map((e) => ({
      ...e.user,
      hasDevice: !!e.user.deviceHash,
    })),
  });
});

export default router;
