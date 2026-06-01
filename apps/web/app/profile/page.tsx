"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { roleLabel, homeForRole } from "@/lib/roles";

type AttendanceRow = {
  id: string;
  status: string;
  scannedAt: string;
  session: { course: { name: string }; startedAt: string };
};

type CourseStat = {
  courseId: string;
  courseName: string;
  courseCode: string | null;
  totalSessions: number;
  attendedSessions: number;
  percent: number;
};

export default function ProfilePage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [courseStats, setCourseStats] = useState<CourseStat[]>([]);
  const [enrollCode, setEnrollCode] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (user) setFullName(user.fullName);
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === "STUDENT") {
      api<{ attendance: AttendanceRow[] }>("/api/attendance/my")
        .then((d) => setAttendance(d.attendance))
        .catch(() => {});
      api<{ courses: CourseStat[] }>("/api/attendance/my/stats")
        .then((d) => setCourseStats(d.courses))
        .catch(() => {});
    }
  }, [user]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      const body: { fullName?: string; password?: string } = { fullName };
      if (password) body.password = password;
      await api("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      setPassword("");
      await refresh();
      setMessage("Профіль збережено");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Помилка");
    }
  };

  const joinCourse = async () => {
    setMessage("");
    try {
      const res = await api<{ message: string }>("/api/courses/join", {
        method: "POST",
        body: JSON.stringify({ enrollCode: enrollCode.trim() }),
      });
      setEnrollCode("");
      setMessage(res.message);
      const stats = await api<{ courses: CourseStat[] }>("/api/attendance/my/stats");
      setCourseStats(stats.courses);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Помилка");
    }
  };

  if (loading || !user) return null;

  const statusUa = (s: string) => {
    if (s === "PRESENT") return "Присутній";
    if (s === "LATE") return "Запізнення";
    if (s === "REJECTED") return "Відхилено";
    return s;
  };

  return (
    <>
      <Nav />
      <main className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ marginBottom: "0.25rem" }}>Особистий кабінет</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
          {roleLabel(user.role)} · {user.email}
        </p>

        {message && (
          <div
            className={`alert ${
              message.includes("збережено") || message.includes("записані")
                ? "alert-success"
                : "alert-error"
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={saveProfile} className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Профіль</h2>
          <div className="field">
            <label className="label">ПІБ</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label">Новий пароль (необов&apos;язково)</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              placeholder="Залиште порожнім, щоб не змінювати"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Зберегти
          </button>
        </form>

        {user.role === "STUDENT" && (
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Записатися на курс</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              Введіть код курсу від викладача
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                className="input"
                placeholder="наприклад PRG101"
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value.toUpperCase())}
              />
              <button type="button" className="btn btn-primary" onClick={joinCourse}>
                Записатися
              </button>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Швидкі дії</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Link href={homeForRole(user.role)} className="btn btn-secondary">
              На головну панель
            </Link>
            {user.role === "STUDENT" && (
              <Link href="/student/scan" className="btn btn-primary">
                Сканувати QR
              </Link>
            )}
          </div>
        </div>

        {user.role === "STUDENT" && courseStats.length > 0 && (
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Відвідуваність по курсах</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {courseStats.map((c) => (
                <div key={c.courseId}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                    <strong>
                      {c.courseName}
                      {c.courseCode && (
                        <span style={{ color: "var(--muted)", fontWeight: 400 }}> ({c.courseCode})</span>
                      )}
                    </strong>
                    <span style={{ fontWeight: 700 }}>{c.percent}%</span>
                  </div>
                  <div className="dash-att-bar-wrap" style={{ width: "100%" }}>
                    <div className="dash-att-bar" style={{ width: `${c.percent}%` }} />
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    {c.attendedSessions} з {c.totalSessions} пар
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {user.role === "STUDENT" && (
          <div className="card">
            <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Історія відміток</h2>
            {attendance.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>Записів поки немає</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Курс</th>
                    <th>Дата</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a) => (
                    <tr key={a.id}>
                      <td>{a.session.course.name}</td>
                      <td>{new Date(a.session.startedAt).toLocaleString("uk-UA")}</td>
                      <td>
                        <span
                          className={`badge ${
                            a.status === "PRESENT"
                              ? "badge-success"
                              : a.status === "LATE"
                                ? "badge-warning"
                                : "badge-danger"
                          }`}
                        >
                          {statusUa(a.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </>
  );
}
