import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateSessionSecret } from "../src/lib/totp";
import { generateEnrollCode } from "../src/lib/enrollCode";

const prisma = new PrismaClient();

const DEFAULT_LAT = 50.4501;
const DEFAULT_LNG = 30.5234;
const DEFAULT_RADIUS_M = 80;

async function clearAcademicData() {
  await prisma.attendance.deleteMany();
  await prisma.usedQrWindow.deleteMany();
  await prisma.session.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.course.deleteMany();
}

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  await clearAcademicData();

  await prisma.user.upsert({
    where: { email: "admin@edu.ua" },
    update: { passwordHash, fullName: "Адміністратор Системи", role: "ADMIN", deviceHash: null },
    create: {
      email: "admin@edu.ua",
      passwordHash,
      fullName: "Адміністратор Системи",
      role: "ADMIN",
    },
  });

  const lecturer = await prisma.user.upsert({
    where: { email: "lecturer@edu.ua" },
    update: { passwordHash, fullName: "Іван Петренко", role: "LECTURER", deviceHash: null },
    create: {
      email: "lecturer@edu.ua",
      passwordHash,
      fullName: "Іван Петренко",
      role: "LECTURER",
    },
  });

  const studentDefs = [
    { email: "student1@edu.ua", fullName: "Олена Коваленко" },
    { email: "student2@edu.ua", fullName: "Андрій Шевченко" },
    { email: "student3@edu.ua", fullName: "Марія Бондар" },
    { email: "student4@edu.ua", fullName: "Дмитро Мельник" },
    { email: "student5@edu.ua", fullName: "Софія Ткаченко" },
  ];

  const students = await Promise.all(
    studentDefs.map((s) =>
      prisma.user.upsert({
        where: { email: s.email },
        update: { ...s, passwordHash, role: "STUDENT", deviceHash: null },
        create: { ...s, passwordHash, role: "STUDENT" },
      })
    )
  );

  const coursePrg = await prisma.course.create({
    data: {
      id: "seed-course-prg",
      name: "Програмування",
      code: "PRG-101",
      enrollCode: "PRG101",
      lecturerId: lecturer.id,
    },
  });

  const courseDb = await prisma.course.create({
    data: {
      id: "seed-course-db",
      name: "Бази даних",
      code: "DB-201",
      enrollCode: generateEnrollCode(),
      lecturerId: lecturer.id,
    },
  });

  const allStudents = students;
  for (const course of [coursePrg, courseDb]) {
    for (const student of allStudents) {
      await prisma.enrollment.create({
        data: { userId: student.id, courseId: course.id },
      });
    }
  }

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(10, 0, 0, 0);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(10, 0, 0, 0);

  const closed1 = await prisma.session.create({
    data: {
      id: "seed-session-closed-1",
      courseId: coursePrg.id,
      lecturerId: lecturer.id,
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LNG,
      radiusMeters: DEFAULT_RADIUS_M,
      totpSecret: generateSessionSecret(),
      status: "CLOSED",
      startedAt: twoDaysAgo,
      endedAt: new Date(twoDaysAgo.getTime() + 90 * 60 * 1000),
    },
  });

  const closed2 = await prisma.session.create({
    data: {
      id: "seed-session-closed-2",
      courseId: courseDb.id,
      lecturerId: lecturer.id,
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LNG,
      radiusMeters: DEFAULT_RADIUS_M,
      totpSecret: generateSessionSecret(),
      status: "CLOSED",
      startedAt: yesterday,
      endedAt: new Date(yesterday.getTime() + 90 * 60 * 1000),
    },
  });

  const activeSession = await prisma.session.create({
    data: {
      id: "seed-session-active",
      courseId: coursePrg.id,
      lecturerId: lecturer.id,
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LNG,
      radiusMeters: DEFAULT_RADIUS_M,
      intervalSeconds: 20,
      totpSecret: generateSessionSecret(),
      status: "ACTIVE",
      startedAt: new Date(),
    },
  });

  const markPresent = async (
    sessionId: string,
    studentId: string,
    status: "PRESENT" | "LATE" = "PRESENT",
    scannedAt?: Date
  ) => {
    await prisma.attendance.create({
      data: {
        sessionId,
        userId: studentId,
        status,
        distanceMeters: 12,
        scannedAt: scannedAt ?? new Date(),
      },
    });
  };

  await markPresent(closed1.id, students[0].id, "PRESENT", twoDaysAgo);
  await markPresent(closed1.id, students[1].id, "PRESENT", twoDaysAgo);
  await markPresent(closed1.id, students[2].id, "LATE", new Date(twoDaysAgo.getTime() + 20 * 60 * 1000));

  await markPresent(closed2.id, students[0].id, "PRESENT", yesterday);
  await markPresent(closed2.id, students[3].id, "PRESENT", yesterday);

  await markPresent(activeSession.id, students[0].id);
  await markPresent(activeSession.id, students[1].id);

  console.log("Початкові дані завантажено.");
  console.log("  admin@edu.ua / lecturer@edu.ua / student1@edu.ua … (пароль demo1234)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
