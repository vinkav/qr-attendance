"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth-context";
import { api, getDeviceHash } from "@/lib/api";

function parseQrPayload(raw: string): { sessionId: string; token: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("qratt:")) return null;
  const parts = trimmed.split(":");
  if (parts.length >= 3) {
    return { sessionId: parts[1], token: parts.slice(2).join(":") };
  }
  return null;
}

export default function StudentScanPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "STUDENT")) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const submitScan = async (sessionId: string, token: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setMessage("Перевірка…");
    setSuccess(false);

    if (!navigator.geolocation) {
      setMessage("Увімкніть геолокацію");
      processingRef.current = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api("/api/auth/device", {
            method: "POST",
            body: JSON.stringify({ deviceHash: getDeviceHash() }),
          });
          const result = await api<{ success: boolean; message: string }>("/api/attendance/scan", {
            method: "POST",
            body: JSON.stringify({
              sessionId,
              token,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              deviceHash: getDeviceHash(),
            }),
          });
          setSuccess(true);
          setMessage(result.message);
          if (scannerRef.current?.isScanning) {
            await scannerRef.current.stop();
            setScanning(false);
          }
        } catch (err) {
          setMessage(err instanceof Error ? err.message : "Помилка відмітки");
        } finally {
          processingRef.current = false;
        }
      },
      () => {
        setMessage("Дозвольте доступ до геолокації");
        processingRef.current = false;
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const onScanSuccess = (decoded: string) => {
    const parsed = parseQrPayload(decoded);
    if (!parsed) {
      setMessage("Невідомий QR-код");
      return;
    }
    submitScan(parsed.sessionId, parsed.token);
  };

  const startScanner = async () => {
    setMessage("");
    setSuccess(false);
    const elId = "qr-reader";
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(elId);
    }
    if (scannerRef.current.isScanning) return;

    try {
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 260, height: 260 } },
        onScanSuccess,
        () => {}
      );
      setScanning(true);
    } catch {
      setMessage("Не вдалося відкрити камеру. Дозвольте доступ.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    setScanning(false);
  };

  if (authLoading || !user) return null;

  return (
    <>
      <Nav />
      <main className="container" style={{ maxWidth: 480 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Відмітка присутності</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
          Увімкніть камеру та геолокацію. Наведіть на QR-код на екрані в аудиторії.
        </p>

        {message && (
          <div className={`alert ${success ? "alert-success" : "alert-error"}`}>{message}</div>
        )}

        <div id="qr-reader" style={{ width: "100%", marginBottom: "1rem" }} />

        <div style={{ display: "flex", gap: "0.5rem" }}>
          {!scanning ? (
            <button type="button" className="btn btn-primary" onClick={startScanner}>
              Увімкнути камеру
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={stopScanner}>
              Зупинити
            </button>
          )}
        </div>

        <p style={{ marginTop: "1.5rem", fontSize: "0.85rem", color: "var(--muted)" }}>
          Демо-студент: student1@demo.edu / demo1234
        </p>
      </main>
    </>
  );
}
