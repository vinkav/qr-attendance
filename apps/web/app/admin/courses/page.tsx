"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { AdminNav } from "@/components/AdminNav";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

type CourseRow = {
  id: string;
  name: string;
  code: string | null;
  enrollCode: string;
  lecturer: { fullName: string; email: string };
  _count: { enrollments: number; sessions: number };
};

export default function AdminCoursesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user?.role !== "ADMIN") router.replace("/login");
  }, [user, loading, router]);

  const load = () =>
    api<{ courses: CourseRow[] }>("/api/admin/courses").then((c) => setCourses(c.courses));

  useEffect(() => {
    if (user?.role === "ADMIN") load().catch((e) => setError(e.message));
  }, [user]);

  const deleteCourse = async (courseId: string, name: string) => {
    if (!confirm(`Видалити курс «${name}»?`)) return;
    try {
      await api(`/api/admin/courses/${courseId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  if (loading || !user) return null;

  return (
    <>
      <Nav />
      <AdminNav />
      <main className="container">
        <h1 style={{ marginBottom: "1rem" }}>Курси</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {courses.map((c) => (
            <div
              key={c.id}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}
            >
              <div>
                <strong>{c.name}</strong>
                {c.code && (
                  <span style={{ color: "var(--muted)", marginLeft: "0.5rem" }}>{c.code}</span>
                )}
                <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  {c.lecturer.fullName} · студентів: {c._count.enrollments} · код запису:{" "}
                  <strong>{c.enrollCode}</strong>
                </p>
              </div>
              <button type="button" className="btn btn-danger" onClick={() => deleteCourse(c.id, c.name)}>
                Видалити
              </button>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
