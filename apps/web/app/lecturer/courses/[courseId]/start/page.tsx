"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { LecturerNav } from "@/components/LecturerNav";
import { BackLink } from "@/components/BackLink";
import { api } from "@/lib/api";

export default function StartSessionPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [radius, setRadius] = useState(80);

  const start = async () => {
    setError("");
    setLoading(true);
    if (!navigator.geolocation) {
      setError("Браузер не підтримує геолокацію");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { session } = await api<{ session: { id: string } }>("/api/sessions", {
            method: "POST",
            body: JSON.stringify({
              courseId,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              radiusMeters: radius,
            }),
          });
          router.push(`/lecturer/sessions/${session.id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Помилка");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError("Дозвольте доступ до геолокації для фіксації координат аудиторії");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <>
      <Nav />
      <LecturerNav />
      <main className="container" style={{ maxWidth: 480 }}>
        <BackLink href={`/lecturer/courses/${courseId}`} label="← До курсу" />
        <h1 style={{ marginBottom: "1rem" }}>Почати сесію</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
          Перебувайте в аудиторії. Система збереже GPS-координати як еталон для перевірки студентів.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="card">
          <div className="field">
            <label className="label">Допустимий радіус (метри)</label>
            <input
              className="input"
              type="number"
              min={30}
              max={300}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={start} disabled={loading}>
            {loading ? "Запуск…" : "Почати пару"}
          </button>
        </div>
      </main>
    </>
  );
}
