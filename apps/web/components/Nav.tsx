"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { roleLabel } from "@/lib/roles";

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
              {user.fullName} ({roleLabel(user.role)})
            </span>
            {user.role === "ADMIN" && <Link href="/admin/dashboard">Адмін</Link>}
            {user.role === "LECTURER" && (
              <>
                <Link href="/lecturer/dashboard">Дашборд</Link>
                <Link href="/lecturer/courses">Курси</Link>
              </>
            )}
            {user.role === "STUDENT" && <Link href="/student/scan">Сканувати</Link>}
            <Link href="/profile">Кабінет</Link>
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
