"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Nav() {
  const { user, logout } = useAuth();

  return (
    <nav className="nav">
      <Link href="/" style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
        QR Відвідуваність
      </Link>
      <div className="nav-links">
        {user ? (
          <>
            <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              {user.fullName} ({user.role === "LECTURER" ? "Викладач" : "Студент"})
            </span>
            {user.role === "LECTURER" && (
              <Link href="/lecturer">Кабінет</Link>
            )}
            {user.role === "STUDENT" && (
              <Link href="/student/scan">Сканувати</Link>
            )}
            <button type="button" className="btn btn-secondary" onClick={logout}>
              Вийти
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Увійти</Link>
            <Link href="/register">Реєстрація</Link>
          </>
        )}
      </div>
    </nav>
  );
}
