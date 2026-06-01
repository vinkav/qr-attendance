import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const lecturer = await prisma.user.upsert({
    where: { email: "lecturer@demo.edu" },
    update: {},
    create: {
      email: "lecturer@demo.edu",
      passwordHash,
      fullName: "Іван Петренко",
      role: "LECTURER",
    },
  });

  const students = await Promise.all(
    [
      { email: "student1@demo.edu", fullName: "Олена Коваленко" },
      { email: "student2@demo.edu", fullName: "Андрій Шевченко" },
      { email: "student3@demo.edu", fullName: "Марія Бондар" },
    ].map((s) =>
      prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: { ...s, passwordHash, role: "STUDENT" },
      })
    )
  );

  const course = await prisma.course.upsert({
    where: { id: "seed-course-1" },
    update: {},
    create: {
      id: "seed-course-1",
      name: "Програмування",
      code: "PRG-101",
      lecturerId: lecturer.id,
    },
  });

  for (const student of students) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: student.id, courseId: course.id } },
      update: {},
      create: { userId: student.id, courseId: course.id },
    });
  }

  console.log("Seed OK:");
  console.log("  Викладач: lecturer@demo.edu / demo1234");
  console.log("  Студенти: student1@demo.edu … student3@demo.edu / demo1234");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
