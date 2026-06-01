"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth-context";
import { api, downloadCsv } from "@/lib/api";

type AttendanceRow = {
  id: string;
  status: string;
  scannedAt: string;
  distanceMeters: number | null;
  user: { fullName: string; email: string };
};

type Absent = { fullName: string; email: string };

export default function SessionDashboardPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [present, setPresent] = useState<AttendanceRow[]>([]);
  const [absent, setAbsent] = useState<Absent[]>([]);
  const [courseName, setCourseName] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await api<{
      session: { courseName: string; status: string };
      present: AttendanceRow[];
      absent: Absent[];
    }>(`/api/sessions/${sessionId}/attendance`);
    setCourseName(data.session.courseName);
    setStatus(data.session.status);
    setPresent(data.present.filter((p) => p.status === "PRESENT" || p.status === "LATE"));
    setAbsent(data.absent);
  }, [sessionId]);

  useEffect(() => {
    if (!authLoading && user?.role !== "LECTURER") router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === "LECTURER") {
      load().catch(console.error);
      const t = setInterval(() => load().catch(console.error), 3000);
      return () => clearInterval(t);
    }
  }, [user, load]);

  const closeSession = async () => {
    setError("");
    try {
      await api(`/api/sessions/${sessionId}/close`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  const exportCsv = async () => {
    try {
      await downloadCsv(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  const statusLabel = (s: string) => {
    if (s === "PRESENT") return "Присутній";
    if (s === "LATE") return "Запізнення";
    return s;
  };

  return (
    <>
      <Nav />
      <main className="container">
        <h1 style={{ marginBottom: "0.25rem" }}>{courseName}</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
          Статус: {status === "ACTIVE" ? "Активна" : "Закрита"}
        </p>
        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {status === "ACTIVE" && (
            <>
              <Link href={`/lecturer/sessions/${sessionId}/display`} className="btn btn-primary">
                QR на проектор
              </Link>
              <button type="button" className="btn btn-danger" onClick={closeSession}>
                Закрити сесію
              </button>
            </>
          )}
          <button type="button" className="btn btn-secondary" onClick={exportCsv}>
            Завантажити CSV
          </button>
        </div>

        <div className="grid-2">
          <div>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
              Присутні ({present.length})
            </h2>
            <div className="card">
              {present.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>Поки нікого</p>
              ) : (
                <ul style={{ listStyle: "none" }}>
                  {present.map((p) => (
                    <li key={p.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid var(--surface2)" }}>
                      <strong>{p.user.fullName}</strong>
                      <span
                        className={`badge ${p.status === "LATE" ? "badge-warning" : "badge-success"}`}
                        style={{ marginLeft: "0.5rem" }}
                      >
                        {statusLabel(p.status)}
                      </span>
                      <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {new Date(p.scannedAt).toLocaleTimeString("uk-UA")}
                        {p.distanceMeters != null && ` · ${Math.round(p.distanceMeters)} м`}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
              Відсутні ({absent.length})
            </h2>
            <div className="card">
              {absent.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>Усі відмічені</p>
              ) : (
                <ul style={{ listStyle: "none" }}>
                  {absent.map((a) => (
                    <li key={a.email} style={{ padding: "0.4rem 0", color: "var(--muted)" }}>
                      {a.fullName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
