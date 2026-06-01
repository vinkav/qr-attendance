import { Role } from "@prisma/client";
import { prisma } from "./prisma";

export async function getCourseIfAllowed(
  courseId: string,
  userId: string,
  role: Role
) {
  if (role === "ADMIN") {
    return prisma.course.findUnique({ where: { id: courseId } });
  }
  return prisma.course.findFirst({
    where: { id: courseId, lecturerId: userId },
  });
}
