"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

type Course = {
  id: string;
  name: string;
  code: string | null;
  _count?: { enrollments: number; sessions: number };
};

export default function LecturerPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [enrollEmail, setEnrollEmail] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "LECTURER")) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  const load = async () => {
    const data = await api<{ courses: Course[] }>("/api/courses");
    setCourses(data.courses);
  };

  useEffect(() => {
    if (user?.role === "LECTURER") load().catch((e) => setError(e.message));
  }, [user]);

  const createCourse = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/courses", {
        method: "POST",
        body: JSON.stringify({ name, code: code || undefined }),
      });
      setName("");
      setCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  const enrollStudent = async (courseId: string) => {
    setError("");
    try {
      await api(`/api/courses/${courseId}/enroll`, {
        method: "POST",
        body: JSON.stringify({ email: enrollEmail }),
      });
      setEnrollEmail("");
      setSelectedCourse(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  if (authLoading || !user) return null;

  return (
    <>
      <Nav />
      <main className="container">
        <h1 style={{ marginBottom: "1rem" }}>Кабінет викладача</h1>
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={createCourse} className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Новий курс</h2>
          <div className="grid-2">
            <div className="field">
              <label className="label">Назва</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label">Код (необов&apos;язково)</label>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Створити курс
          </button>
        </form>

        <h2 style={{ marginBottom: "0.75rem" }}>Мої курси</h2>
        {courses.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Поки немає курсів</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {courses.map((c) => (
              <div key={c.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <strong>{c.name}</strong>
                    {c.code && <span style={{ color: "var(--muted)", marginLeft: "0.5rem" }}>{c.code}</span>}
                    <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                      Студентів: {c._count?.enrollments ?? 0}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Link href={`/lecturer/courses/${c.id}/start`} className="btn btn-primary">
                      Почати пару
                    </Link>
                    <Link href={`/lecturer/courses/${c.id}`} className="btn btn-secondary">
                      Сесії
                    </Link>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSelectedCourse(selectedCourse === c.id ? null : c.id)}
                    >
                      + Студент
                    </button>
                  </div>
                </div>
                {selectedCourse === c.id && (
                  <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                    <input
                      className="input"
                      placeholder="email студента"
                      value={enrollEmail}
                      onChange={(e) => setEnrollEmail(e.target.value)}
                    />
                    <button type="button" className="btn btn-primary" onClick={() => enrollStudent(c.id)}>
                      Додати
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
