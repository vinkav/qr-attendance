"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { roleLabel } from "@/lib/roles";

export function Nav() {
  const { user, logout } = useAuth();

  return (
    <nav className="nav">
      <Link href="/" className="nav-brand">
        QR Відвідуваність
      </Link>
      <div className="nav-links">
        {user ? (
          <>
            <span className="nav-user" title={`${user.fullName} (${roleLabel(user.role)})`}>
              <span className="nav-user-name">{user.fullName}</span>
              <span className="nav-user-role"> ({roleLabel(user.role)})</span>
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
            <button type="button" className="btn btn-secondary nav-logout" onClick={logout}>
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
