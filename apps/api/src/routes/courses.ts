import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { role, userId } = req.auth!;

  if (role === "LECTURER" || role === "ADMIN") {
    const courses = await prisma.course.findMany({
      where: { lecturerId: userId },
      include: { _count: { select: { enrollments: true, sessions: true } } },
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
      lecturerId: req.auth!.userId,
    },
  });
  res.status(201).json({ course });
});

router.post("/:courseId/enroll", requireRole("LECTURER", "ADMIN"), async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Вкажіть email студента" });
    return;
  }

  const course = await prisma.course.findFirst({
    where: { id: req.params.courseId, lecturerId: req.auth!.userId },
  });
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

router.get("/:courseId/students", requireRole("LECTURER", "ADMIN"), async (req, res) => {
  const course = await prisma.course.findFirst({
    where: { id: req.params.courseId, lecturerId: req.auth!.userId },
  });
  if (!course) {
    res.status(404).json({ error: "Курс не знайдено" });
    return;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: course.id },
    include: { user: { select: { id: true, email: true, fullName: true } } },
  });
  res.json({ students: enrollments.map((e) => e.user) });
});

export default router;
