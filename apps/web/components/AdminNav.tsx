"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/dashboard", label: "Огляд", match: (p: string) => p === "/admin/dashboard" || p === "/admin" },
  { href: "/admin/users", label: "Користувачі", match: (p: string) => p === "/admin/users" },
  { href: "/admin/courses", label: "Курси", match: (p: string) => p === "/admin/courses" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="subnav">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`subnav-link${t.match(pathname) ? " subnav-link-active" : ""}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
