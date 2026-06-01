"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { AdminNav } from "@/components/AdminNav";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

type Stats = {
  students: number;
  lecturers: number;
  admins: number;
  courses: number;
  sessions: number;
  attendanceRecords: number;
};

export default function AdminDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user?.role !== "ADMIN") router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      api<{ stats: Stats }>("/api/admin/stats")
        .then((s) => setStats(s.stats))
        .catch((e) => setError(e.message));
    }
  }, [user]);

  if (loading || !user) return null;

  return (
    <>
      <Nav />
      <AdminNav />
      <main className="container">
        <h1 style={{ marginBottom: "1rem" }}>Огляд системи</h1>
        {error && <div className="alert alert-error">{error}</div>}
        {stats && (
          <div className="grid-2">
            <div className="card">
              <strong>Студентів</strong>
              <p style={{ fontSize: "1.5rem", marginTop: "0.25rem" }}>{stats.students}</p>
            </div>
            <div className="card">
              <strong>Викладачів</strong>
              <p style={{ fontSize: "1.5rem", marginTop: "0.25rem" }}>{stats.lecturers}</p>
            </div>
            <div className="card">
              <strong>Курсів</strong>
              <p style={{ fontSize: "1.5rem", marginTop: "0.25rem" }}>{stats.courses}</p>
            </div>
            <div className="card">
              <strong>Сесій</strong>
              <p style={{ fontSize: "1.5rem", marginTop: "0.25rem" }}>{stats.sessions}</p>
            </div>
            <div className="card">
              <strong>Відміток</strong>
              <p style={{ fontSize: "1.5rem", marginTop: "0.25rem" }}>{stats.attendanceRecords}</p>
            </div>
            <div className="card">
              <strong>Адміністраторів</strong>
              <p style={{ fontSize: "1.5rem", marginTop: "0.25rem" }}>{stats.admins}</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
