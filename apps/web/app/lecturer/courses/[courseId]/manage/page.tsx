"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { LecturerNav } from "@/components/LecturerNav";
import { BackLink } from "@/components/BackLink";
import { useAuth } from "@/lib/auth-context";
import { api, downloadCourseReport } from "@/lib/api";

type Student = { id: string; email: string; fullName: string; hasDevice?: boolean };
type Course = { id: string; name: string; code: string | null; enrollCode: string };

export default function CourseManagePage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authLoading && user && user.role !== "LECTURER" && user.role !== "ADMIN") {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  const load = async () => {
    const [c, s] = await Promise.all([
      api<{ course: Course }>(`/api/courses/${courseId}`),
      api<{ students: Student[] }>(`/api/courses/${courseId}/students`),
    ]);
    setCourse(c.course);
    setStudents(s.students);
  };

  useEffect(() => {
    if (user?.role === "LECTURER" || user?.role === "ADMIN") {
      load().catch((e) => setError(e.message));
    }
  }, [user, courseId]);

  const enroll = async () => {
    setError("");
    setMessage("");
    try {
      await api(`/api/courses/${courseId}/enroll`, {
        method: "POST",
        body: JSON.stringify({ email: enrollEmail }),
      });
      setEnrollEmail("");
      setMessage("Студента додано");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  const enrollBulk = async () => {
    setError("");
    setMessage("");
    try {
      const res = await api<{ added: number; notFound: string[]; message: string }>(
        `/api/courses/${courseId}/enroll/bulk`,
        { method: "POST", body: JSON.stringify({ text: bulkText }) }
      );
      setBulkText("");
      setMessage(
        res.notFound.length > 0
          ? `${res.message}. Не знайдено: ${res.notFound.join(", ")}`
          : res.message
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  const regenerateCode = async () => {
    if (!confirm("Згенерувати новий код запису? Старий перестане працювати.")) return;
    try {
      const res = await api<{ course: Course }>(
        `/api/courses/${courseId}/enroll-code/regenerate`,
        { method: "POST" }
      );
      setCourse((c) => (c ? { ...c, enrollCode: res.course.enrollCode } : c));
      setMessage("Новий код запису згенеровано");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  const copyCode = () => {
    if (course?.enrollCode) {
      navigator.clipboard.writeText(course.enrollCode);
      setMessage("Код скопійовано");
    }
  };

  const removeStudent = async (student: Student) => {
    if (!confirm(`Видалити ${student.fullName} з курсу?`)) return;
    setError("");
    try {
      await api(`/api/courses/${courseId}/students/${student.id}`, { method: "DELETE" });
      setMessage("Студента видалено з курсу");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  const resetDevice = async (student: Student) => {
    if (!confirm(`Скинути прив'язку пристрою для ${student.fullName}?`)) return;
    try {
      await api(`/api/courses/${courseId}/students/${student.id}/reset-device`, {
        method: "POST",
      });
      setMessage("Пристрій скинуто");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  const exportPeriod = async () => {
    setError("");
    try {
      await downloadCourseReport(courseId, reportFrom, reportTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  if (authLoading || !user) return null;

  return (
    <>
      <Nav />
      <LecturerNav />
      <main className="container">
        <BackLink href="/lecturer/courses" label="← До курсів" />
        <h1 style={{ marginBottom: "0.25rem" }}>{course?.name ?? "Курс"}</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>Керування студентами</p>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {course && (
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Код для самозапису студентів</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              Студент вводить код у особистому кабінеті → «Записатися на курс»
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <code
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  padding: "0.5rem 1rem",
                  background: "var(--bg)",
                  borderRadius: 8,
                }}
              >
                {course.enrollCode}
              </code>
              <button type="button" className="btn btn-secondary" onClick={copyCode}>
                Копіювати
              </button>
              <button type="button" className="btn btn-secondary" onClick={regenerateCode}>
                Новий код
              </button>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Додати одного студента</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              className="input"
              placeholder="email студента"
              value={enrollEmail}
              onChange={(e) => setEnrollEmail(e.target.value)}
            />
            <button type="button" className="btn btn-primary" onClick={enroll}>
              Додати
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Масове додавання</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            Вставте список email — по рядку, через кому або крапку з комою
          </p>
          <textarea
            className="input"
            rows={5}
            placeholder={"student1@edu.ua\nstudent2@edu.ua"}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            style={{ resize: "vertical", marginBottom: "0.75rem" }}
          />
          <button type="button" className="btn btn-primary" onClick={enrollBulk}>
            Додати всіх
          </button>
        </div>

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Звіт за період</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
            CSV: студенти × сесії з відсотком відвідуваності
          </p>
          <div className="grid-2" style={{ marginBottom: "0.75rem" }}>
            <div className="field" style={{ margin: 0 }}>
              <label className="label">Від</label>
              <input
                type="date"
                className="input"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label className="label">До</label>
              <input
                type="date"
                className="input"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
              />
            </div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={exportPeriod}>
            Завантажити CSV за період
          </button>
        </div>

        <h2 style={{ marginBottom: "0.75rem" }}>Записані студенти ({students.length})</h2>
        {students.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Немає студентів</p>
        ) : (
          <div className="card">
            <ul style={{ listStyle: "none" }}>
              {students.map((s) => (
                <li
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.6rem 0",
                    borderBottom: "1px solid var(--surface2)",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>{s.fullName}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                      {s.email}
                      {s.hasDevice && " · пристрій прив'язано"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    {s.hasDevice && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => resetDevice(s)}
                      >
                        Скинути пристрій
                      </button>
                    )}
                    <button type="button" className="btn btn-danger" onClick={() => removeStudent(s)}>
                      Видалити
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
