"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { LecturerNav } from "@/components/LecturerNav";
import { LecturerDashboard } from "@/components/dashboard/LecturerDashboard";
import { useAuth } from "@/lib/auth-context";

export default function LecturerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user && user.role !== "LECTURER" && user.role !== "ADMIN") {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) return null;

  return (
    <>
      <Nav />
      <LecturerNav />
      <main className="container">
        <h1 style={{ marginBottom: "0.25rem" }}>Дашборд</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
          Жива статистика, графік і швидкий доступ до сесій
        </p>
        <LecturerDashboard />
      </main>
    </>
  );
}
