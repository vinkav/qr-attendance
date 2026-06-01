import { AttendanceStatus } from "@prisma/client";

type EnrolledUser = { fullName: string; email: string };
type SessionRow = { id: string; startedAt: Date };
type AttRecord = {
  status: AttendanceStatus;
  user: { email: string };
  sessionId: string;
};

export function buildCoursePeriodCsv(
  courseName: string,
  sessions: SessionRow[],
  enrolled: EnrolledUser[],
  attendance: AttRecord[]
): string {
  const attMap = new Map<string, AttendanceStatus>();
  for (const a of attendance) {
    if (a.status === "PRESENT" || a.status === "LATE") {
      attMap.set(`${a.sessionId}:${a.user.email}`, a.status);
    }
  }

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    "ПІБ",
    "Email",
    ...sessions.map((s) => {
      const d = s.startedAt.toLocaleDateString("uk-UA");
      const t = s.startedAt.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
      return `${d} ${t}`;
    }),
    "Відвідано",
    "Всього пар",
    "Відсоток",
  ];

  const lines = [header.map(escape).join(",")];

  for (const e of enrolled) {
    let attended = 0;
    const cells = sessions.map((s) => {
      const st = attMap.get(`${s.id}:${e.email}`);
      if (st === "PRESENT") {
        attended++;
        return "Присутній";
      }
      if (st === "LATE") {
        attended++;
        return "Запізнення";
      }
      return "Відсутній";
    });
    const total = sessions.length;
    const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
    lines.push(
      [e.fullName, e.email, ...cells, String(attended), String(total), `${pct}%`]
        .map(escape)
        .join(",")
    );
  }

  return "\uFEFF" + lines.join("\n");
}
