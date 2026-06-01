"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type SessionRow = {
  id: string;
  status: string;
  startedAt: string;
  courseName: string;
  enrolled: number;
  present: number;
  attendanceRate: number;
};

type DashboardData = {
  stats: {
    coursesCount: number;
    studentsCount: number;
    activeSessions: number;
    sessionsTotal: number;
  };
  weeklyActivity: { date: string; count: number; label: string }[];
  activeSessions: SessionRow[];
  recentSessions: SessionRow[];
  courses: {
    id: string;
    name: string;
    code: string | null;
    enrollments: number;
    sessions: number;
    lastSession: {
      id: string;
      status: string;
      startedAt: string;
      present: number;
    } | null;
  }[];
};

type Filter = "all" | "active" | "closed";
type StatFocus = "all" | "courses" | "students" | "active" | "sessions";

const REFRESH_MS = 12_000;

function statusBadge(status: string) {
  if (status === "ACTIVE") return <span className="badge badge-success">Активна</span>;
  return <span className="badge" style={{ background: "var(--surface2)", color: "var(--muted)" }}>Закрита</span>;
}

function AttendanceBar({ present, enrolled, rate }: { present: number; enrolled: number; rate: number }) {
  return (
    <div className="dash-att-bar-wrap" title={`${present} з ${enrolled} (${rate}%)`}>
      <div className="dash-att-bar" style={{ width: `${Math.min(rate, 100)}%` }} />
      <span className="dash-att-label">
        {present}/{enrolled} · {rate}%
      </span>
    </div>
  );
}

export function LecturerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [statFocus, setStatFocus] = useState<StatFocus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const d = await api<DashboardData>("/api/lecturer/dashboard");
      setData(d);
      setLastUpdated(new Date());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const maxWeek = useMemo(
    () => Math.max(1, ...(data?.weeklyActivity.map((d) => d.count) ?? [1])),
    [data]
  );

  const filteredSessions = useMemo(() => {
    if (!data) return [];
    const list = data.recentSessions;
    if (filter === "active") return list.filter((s) => s.status === "ACTIVE");
    if (filter === "closed") return list.filter((s) => s.status !== "ACTIVE");
    return list;
  }, [data, filter]);

  const statCards: { key: StatFocus; label: string; value: number; hint: string; href?: string }[] = data
    ? [
        { key: "courses", label: "Курсів", value: data.stats.coursesCount, hint: "Перейти до курсів", href: "/lecturer/courses" },
        { key: "students", label: "Студентів", value: data.stats.studentsCount, hint: "Усі записи на курси" },
        { key: "active", label: "Активних пар", value: data.stats.activeSessions, hint: "Фільтр активних" },
        { key: "sessions", label: "Всього сесій", value: data.stats.sessionsTotal, hint: "Історія сесій" },
      ]
    : [];

  const onStatClick = (key: StatFocus, href?: string) => {
    if (href) return;
    setStatFocus((prev) => (prev === key ? "all" : key));
    if (key === "active") setFilter("active");
    else if (key === "sessions") setFilter("all");
    else setFilter("all");
  };

  if (!data && !error) {
    return <p style={{ color: "var(--muted)" }}>Завантаження дашборду…</p>;
  }

  return (
    <div className="dash">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="dash-toolbar">
        <span className="dash-updated">
          {lastUpdated && (
            <>
              Оновлено {lastUpdated.toLocaleTimeString("uk-UA")}
              {refreshing && " · оновлення…"}
            </>
          )}
        </span>
        <button type="button" className="btn btn-secondary" onClick={() => load()} disabled={refreshing}>
          Оновити
        </button>
      </div>

      {data && data.activeSessions.length > 0 && (
        <div className="dash-active-banner">
          <div>
            <strong>Зараз йде {data.activeSessions.length} активна пара</strong>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
              {data.activeSessions.map((s) => s.courseName).join(" · ")}
            </p>
          </div>
          <Link href={`/lecturer/sessions/${data.activeSessions[0].id}`} className="btn btn-primary">
            Відкрити сесію
          </Link>
        </div>
      )}

      {data && (
        <div className="dash-stats">
          {statCards.map((c) => {
            const className = `dash-stat-card${statFocus === c.key ? " dash-stat-card-focus" : ""}`;
            const inner = (
              <>
                <span className="dash-stat-label">{c.label}</span>
                <span className="dash-stat-value">{c.value}</span>
                <span className="dash-stat-hint">{c.hint}</span>
              </>
            );
            return c.href ? (
              <Link key={c.key} href={c.href} className={className}>
                {inner}
              </Link>
            ) : (
              <button
                key={c.key}
                type="button"
                className={className}
                onClick={() => onStatClick(c.key)}
                aria-pressed={statFocus === c.key}
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}

      {data && (
        <div className="card dash-chart-card">
          <h2 className="dash-section-title">Активність за 7 днів</h2>
          <p className="dash-section-sub">Кількість проведених сесій по днях</p>
          <div className="dash-chart" role="img" aria-label="Графік сесій за тиждень">
            {data.weeklyActivity.map((d) => (
              <button
                key={d.date}
                type="button"
                className="dash-chart-bar-col"
                title={`${d.label}: ${d.count} сесій`}
              >
                <span className="dash-chart-count">{d.count > 0 ? d.count : ""}</span>
                <span
                  className="dash-chart-bar"
                  style={{ height: `${(d.count / maxWeek) * 100}%` }}
                />
                <span className="dash-chart-label">{d.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {data && data.courses.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 className="dash-section-title">Курси</h2>
          <div className="dash-courses">
            {data.courses.map((c) => (
              <Link key={c.id} href={`/lecturer/courses/${c.id}`} className="dash-course-card card">
                <strong>{c.name}</strong>
                {c.code && <span className="dash-course-code">{c.code}</span>}
                <p className="dash-course-meta">
                  {c.enrollments} студ. · {c.sessions} сесій
                </p>
                {c.lastSession ? (
                  <p className="dash-course-last">
                    Остання: {new Date(c.lastSession.startedAt).toLocaleDateString("uk-UA")} ·{" "}
                    {c.lastSession.present} відміток
                    {c.lastSession.status === "ACTIVE" && (
                      <span className="dash-pulse" aria-hidden />
                    )}
                  </p>
                ) : (
                  <p className="dash-course-last">Сесій ще не було</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="dash-sessions-head">
            <h2 className="dash-section-title">Сесії</h2>
            <div className="dash-filters" role="tablist">
              {(
                [
                  ["all", "Усі"],
                  ["active", "Активні"],
                  ["closed", "Закриті"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  className={`dash-filter${filter === id ? " dash-filter-active" : ""}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredSessions.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>
              Немає сесій для цього фільтра.{" "}
              <Link href="/lecturer/courses">Створити пару</Link>
            </p>
          ) : (
            <ul className="dash-session-list">
              {filteredSessions.map((s) => {
                const open = expandedId === s.id;
                return (
                  <li key={s.id} className={`card dash-session-item${open ? " dash-session-open" : ""}`}>
                    <button
                      type="button"
                      className="dash-session-toggle"
                      onClick={() => setExpandedId(open ? null : s.id)}
                      aria-expanded={open}
                    >
                      <div className="dash-session-main">
                        <span className="dash-session-course">{s.courseName}</span>
                        <span className="dash-session-time">
                          {new Date(s.startedAt).toLocaleString("uk-UA")}
                        </span>
                      </div>
                      <div className="dash-session-side">
                        {statusBadge(s.status)}
                        <AttendanceBar present={s.present} enrolled={s.enrolled} rate={s.attendanceRate} />
                      </div>
                    </button>
                    {open && (
                      <div className="dash-session-detail">
                        <p>
                          Відвідуваність: <strong>{s.present}</strong> з <strong>{s.enrolled}</strong> студентів
                        </p>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                          <Link href={`/lecturer/sessions/${s.id}`} className="btn btn-primary">
                            Керувати сесією
                          </Link>
                          {s.status === "ACTIVE" && (
                            <Link
                              href={`/lecturer/sessions/${s.id}/display`}
                              className="btn btn-secondary"
                            >
                              Показати QR
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
