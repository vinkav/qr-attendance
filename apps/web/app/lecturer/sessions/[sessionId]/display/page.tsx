"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";

export default function QrDisplayPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [token, setToken] = useState("");
  const [expiresIn, setExpiresIn] = useState(20);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const fetchQr = async () => {
      try {
        const data = await api<{
          token: string;
          expiresIn: number;
          intervalSeconds: number;
        }>(`/api/sessions/${sessionId}/qr`);
        if (active) {
          setToken(data.token);
          setExpiresIn(data.expiresIn);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Помилка");
      }
    };

    fetchQr();
    const interval = setInterval(fetchQr, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sessionId]);

  const payload = token ? `qratt:${sessionId}:${token}` : "";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        color: "#111",
        padding: "2rem",
        position: "relative",
      }}
    >
      <Link
        href={`/lecturer/sessions/${sessionId}`}
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          padding: "0.5rem 1rem",
          background: "#f1f5f9",
          color: "#111",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "0.9rem",
        }}
      >
        ← Назад до сесії
      </Link>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Відскануйте QR-код</h1>
      <p style={{ color: "#555", marginBottom: "1.5rem" }}>
        Код оновлюється кожні ~20 с · залишилось ~{expiresIn} с
      </p>
      {error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : token ? (
        <div style={{ padding: 24, background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
          <QRCodeSVG value={payload} size={320} level="M" includeMargin />
        </div>
      ) : (
        <p>Завантаження…</p>
      )}
      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "#888" }}>
        Сесія: {sessionId.slice(0, 8)}…
      </p>
    </div>
  );
}
