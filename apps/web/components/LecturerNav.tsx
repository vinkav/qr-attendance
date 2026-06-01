"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/lecturer/dashboard", label: "Дашборд", match: (p: string) => p === "/lecturer/dashboard" },
  {
    href: "/lecturer/courses",
    label: "Курси",
    match: (p: string) => p === "/lecturer/courses" || p.startsWith("/lecturer/courses/"),
  },
];

export function LecturerNav() {
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
