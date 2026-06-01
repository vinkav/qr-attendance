import { Router } from "express";
import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { haversineDistanceM } from "../lib/geo";
import { verifyQrToken } from "../lib/totp";

const router = Router();

router.use(requireAuth);
router.use(requireRole("STUDENT"));

const scanSchema = z.object({
  sessionId: z.string(),
  token: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  deviceHash: z.string().min(8).max(128).optional(),
});

router.post("/scan", async (req, res) => {
  const parsed = scanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні дані для відмітки" });
    return;
  }

  const { sessionId, token, latitude, longitude, deviceHash } = parsed.data;
  const userId = req.auth!.userId;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { course: true },
  });

  if (!session || session.status !== "ACTIVE") {
    res.status(400).json({ error: "Сесія не активна або не існує" });
    return;
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: session.courseId } },
  });
  if (!enrollment) {
    res.status(403).json({ error: "Ви не записані на цей курс" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: "Користувача не знайдено" });
    return;
  }

  if (deviceHash) {
    if (user.deviceHash && user.deviceHash !== deviceHash) {
      res.status(403).json({
        error: "Відмітка з іншого пристрою заборонена",
        code: "DEVICE_MISMATCH",
      });
      return;
    }
    if (!user.deviceHash) {
      await prisma.user.update({
        where: { id: userId },
        data: { deviceHash },
      });
    }
  }

  const tokenCheck = verifyQrToken(token, sessionId, session.totpSecret, session.intervalSeconds);
  if (!tokenCheck.valid || tokenCheck.window === undefined) {
    await recordRejected(sessionId, userId, tokenCheck.reason ?? "Невірний QR", deviceHash);
    res.status(400).json({ error: tokenCheck.reason ?? "Невірний QR-код" });
    return;
  }

  const qrWindow = tokenCheck.window;

  const existingWindow = await prisma.usedQrWindow.findUnique({
    where: { sessionId_window: { sessionId, window: qrWindow } },
  });
  if (existingWindow) {
    const dup = await prisma.attendance.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (dup && (dup.status === "PRESENT" || dup.status === "LATE")) {
      res.json({
        success: true,
        message: "Ви вже відмічені на цій парі",
        attendance: dup,
      });
      return;
    }
    res.status(400).json({ error: "Цей QR-код вже використано іншим студентом" });
    return;
  }

  const distanceM = haversineDistanceM(
    latitude,
    longitude,
    session.latitude,
    session.longitude
  );

  if (distanceM > session.radiusMeters) {
    await recordRejected(
      sessionId,
      userId,
      `Занадто далеко (${Math.round(distanceM)} м)`,
      deviceHash,
      distanceM
    );
    res.status(400).json({
      error: `Ви поза аудиторією (${Math.round(distanceM)} м, допустимо ${session.radiusMeters} м)`,
      distanceMeters: Math.round(distanceM),
    });
    return;
  }

  const existing = await prisma.attendance.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
  });
  if (existing && (existing.status === "PRESENT" || existing.status === "LATE")) {
    res.json({ success: true, message: "Ви вже відмічені", attendance: existing });
    return;
  }

  const minutesSinceStart =
    (Date.now() - session.startedAt.getTime()) / 1000 / 60;
  const status: AttendanceStatus = minutesSinceStart > 15 ? "LATE" : "PRESENT";

  try {
    const attendance = await prisma.$transaction(async (tx) => {
      await tx.usedQrWindow.create({
        data: { sessionId, window: qrWindow },
      });
      return tx.attendance.upsert({
        where: { sessionId_userId: { sessionId, userId } },
        create: {
          sessionId,
          userId,
          distanceMeters: distanceM,
          status,
          deviceHash,
        },
        update: {
          distanceMeters: distanceM,
          status,
          scannedAt: new Date(),
          rejectReason: null,
        },
      });
    });

    res.status(201).json({
      success: true,
      message: status === "LATE" ? "Відмітку зараховано (запізнення)" : "Присутність зараховано",
      attendance: attendance,
      distanceMeters: Math.round(distanceM),
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "P2002") {
      res.status(400).json({ error: "Цей QR-код вже використано" });
      return;
    }
    throw e;
  }
});

async function recordRejected(
  sessionId: string,
  userId: string,
  reason: string,
  deviceHash?: string,
  distanceM?: number
) {
  await prisma.attendance.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    create: {
      sessionId,
      userId,
      status: "REJECTED",
      rejectReason: reason,
      deviceHash,
      distanceMeters: distanceM,
    },
    update: {
      status: "REJECTED",
      rejectReason: reason,
      scannedAt: new Date(),
      distanceMeters: distanceM,
    },
  });
}

router.get("/my/stats", async (req, res) => {
  const userId = req.auth!.userId;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: { course: { select: { id: true, name: true, code: true } } },
  });

  const courses = [];
  for (const e of enrollments) {
    const sessions = await prisma.session.findMany({
      where: { courseId: e.courseId },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    const attended =
      sessionIds.length === 0
        ? 0
        : await prisma.attendance.count({
            where: {
              userId,
              sessionId: { in: sessionIds },
              status: { in: ["PRESENT", "LATE"] },
            },
          });
    const total = sessions.length;
    courses.push({
      courseId: e.course.id,
      courseName: e.course.name,
      courseCode: e.course.code,
      totalSessions: total,
      attendedSessions: attended,
      percent: total > 0 ? Math.round((attended / total) * 100) : 0,
    });
  }

  res.json({ courses });
});

router.get("/my", async (req, res) => {
  const records = await prisma.attendance.findMany({
    where: { userId: req.auth!.userId },
    include: {
      session: { include: { course: { select: { name: true } } } },
    },
    orderBy: { scannedAt: "desc" },
    take: 50,
  });
  res.json({ attendance: records });
});

export default router;
