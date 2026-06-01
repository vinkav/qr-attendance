import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);
router.use(requireRole("LECTURER", "ADMIN"));

router.get("/dashboard", async (req, res) => {
  const { userId, role } = req.auth!;
  const whereLecturer = role === "ADMIN" ? {} : { lecturerId: userId };
  const whereCourse = role === "ADMIN" ? {} : { lecturerId: userId };

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);

  const [courses, activeSessionsList, recentSessions, weekSessions] = await Promise.all([
    prisma.course.findMany({
      where: whereCourse,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { enrollments: true, sessions: true } },
        sessions: {
          take: 1,
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            status: true,
            startedAt: true,
            _count: {
              select: {
                attendance: { where: { status: { in: ["PRESENT", "LATE"] } } },
              },
            },
          },
        },
      },
    }),
    prisma.session.findMany({
      where: { status: "ACTIVE", ...whereLecturer },
      orderBy: { startedAt: "desc" },
      include: {
        course: { select: { name: true, _count: { select: { enrollments: true } } } },
        _count: {
          select: {
            attendance: { where: { status: { in: ["PRESENT", "LATE"] } } },
          },
        },
      },
    }),
    prisma.session.findMany({
      where: whereLecturer,
      orderBy: { startedAt: "desc" },
      take: 12,
      include: {
        course: { select: { name: true, _count: { select: { enrollments: true } } } },
        _count: {
          select: {
            attendance: { where: { status: { in: ["PRESENT", "LATE"] } } },
          },
        },
      },
    }),
    prisma.session.findMany({
      where: { ...whereLecturer, startedAt: { gte: weekAgo } },
      select: { startedAt: true, status: true },
    }),
  ]);

  const totalStudents = courses.reduce((s, c) => s + c._count.enrollments, 0);
  const sessionsTotal = courses.reduce((s, c) => s + c._count.sessions, 0);

  const weeklyActivity: { date: string; count: number; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const count = weekSessions.filter((s) => s.startedAt.toISOString().slice(0, 10) === key).length;
    weeklyActivity.push({
      date: key,
      count,
      label: d.toLocaleDateString("uk-UA", { weekday: "short", day: "numeric" }),
    });
  }

  const mapSession = (s: (typeof recentSessions)[number]) => {
    const enrolled = s.course._count.enrollments;
    const present = s._count.attendance;
    return {
      id: s.id,
      status: s.status,
      startedAt: s.startedAt,
      courseName: s.course.name,
      enrolled,
      present,
      attendanceRate: enrolled > 0 ? Math.round((present / enrolled) * 100) : 0,
    };
  };

  res.json({
    stats: {
      coursesCount: courses.length,
      studentsCount: totalStudents,
      activeSessions: activeSessionsList.length,
      sessionsTotal,
    },
    weeklyActivity,
    activeSessions: activeSessionsList.map(mapSession),
    recentSessions: recentSessions.map(mapSession),
    courses: courses.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      enrollments: c._count.enrollments,
      sessions: c._count.sessions,
      lastSession: c.sessions[0]
        ? {
            id: c.sessions[0].id,
            status: c.sessions[0].status,
            startedAt: c.sessions[0].startedAt,
            present: c.sessions[0]._count.attendance,
          }
        : null,
    })),
  });
});

export default router;
