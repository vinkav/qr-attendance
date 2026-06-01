"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth-context";
import { homeForRole } from "@/lib/roles";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(homeForRole(user.role));
    }
  }, [user, loading, router]);

  return (
    <>
      <Nav />
      <main className="container" style={{ paddingTop: "3rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>
          Облік відвідуваності за QR
        </h1>
        <p style={{ color: "var(--muted)", maxWidth: 560, marginBottom: "2rem", lineHeight: 1.6 }}>
          Динамічні QR-коди, перевірка геолокації та прив&apos;язка пристрою.
          Викладач показує код на проекторі — студент сканує з телефона в аудиторії.
        </p>
        <div className="grid-2" style={{ maxWidth: 520 }}>
          <div className="card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Викладач</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
              Курси, сесії, список присутніх, звіт CSV
            </p>
            <Link href="/login" className="btn btn-primary">
              Увійти
            </Link>
          </div>
          <div className="card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Студент</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
              Скан QR, GPS, миттєва відмітка
            </p>
            <Link href="/login" className="btn btn-primary">
              Увійти
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
