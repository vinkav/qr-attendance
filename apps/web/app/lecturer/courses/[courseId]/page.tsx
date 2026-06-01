"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

type Session = {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  _count: { attendance: number };
};

export default function CourseSessionsPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (!authLoading && user?.role !== "LECTURER") router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === "LECTURER") {
      api<{ sessions: Session[] }>(`/api/sessions/course/${courseId}`)
        .then((d) => setSessions(d.sessions))
        .catch(console.error);
    }
  }, [user, courseId]);

  return (
    <>
      <Nav />
      <main className="container">
        <Link href="/lecturer" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          ← Назад
        </Link>
        <h1 style={{ margin: "1rem 0" }}>Історія сесій</h1>
        {sessions.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Сесій ще немає</p>
        ) : (
          <table className="table card" style={{ display: "block", overflowX: "auto" }}>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Статус</th>
                <th>Присутніх</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.startedAt).toLocaleString("uk-UA")}</td>
                  <td>
                    <span className={`badge ${s.status === "ACTIVE" ? "badge-success" : ""}`}>
                      {s.status === "ACTIVE" ? "Активна" : "Закрита"}
                    </span>
                  </td>
                  <td>{s._count.attendance}</td>
                  <td>
                    <Link href={`/lecturer/sessions/${s.id}`}>Відкрити</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
