"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode, type CameraDevice } from "html5-qrcode";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth-context";
import { api, getDeviceHash } from "@/lib/api";

type CameraConfig = string | { facingMode: string };

function parseQrPayload(raw: string): { sessionId: string; token: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("qratt:")) return null;
  const parts = trimmed.split(":");
  if (parts.length >= 3) {
    return { sessionId: parts[1], token: parts.slice(2).join(":") };
  }
  return null;
}

function needsHttpsForCamera(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return false;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1";
}

function isFrontCamera(label: string): boolean {
  return /front|user|selfie|face|фронт|вбудован/i.test(label);
}

function isBackCamera(label: string): boolean {
  return /back|rear|environment|зад|telephoto|широк/i.test(label);
}

/** Задні камери першими; на iOS без підписів — остання в списку часто задня. */
function sortCamerasForQr(cameras: CameraDevice[]): CameraDevice[] {
  if (cameras.length <= 1) return cameras;

  const labeled = cameras.some((c) => c.label?.trim().length > 0);
  if (!labeled) {
    return [...cameras].reverse();
  }

  return [...cameras].sort((a, b) => {
    const score = (c: CameraDevice) => {
      const l = (c.label || "").toLowerCase();
      if (isBackCamera(l)) return 0;
      if (isFrontCamera(l)) return 10;
      return 5;
    };
    return score(a) - score(b);
  });
}

function cameraLabelUa(cam: CameraDevice, index: number, total: number): string {
  const l = cam.label || "";
  if (isBackCamera(l)) return "Задня камера";
  if (isFrontCamera(l)) return "Фронтальна камера";
  if (!l.trim() && total === 2) {
    return index === 0 ? "Камера 1 (зазвичай задня)" : "Камера 2 (зазвичай фронтальна)";
  }
  return l.trim() || `Камера ${index + 1}`;
}

export default function StudentScanPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [httpsHint, setHttpsHint] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "STUDENT")) {
      router.replace("/login");
    }
    setHttpsHint(needsHttpsForCamera());
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

  const runScanner = async (camera: CameraConfig) => {
    const elId = "qr-reader";
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(elId, { verbose: false });
    }
    const box = Math.min(280, Math.floor(window.innerWidth * 0.75));
    await scannerRef.current.start(
      camera,
      { fps: 10, qrbox: { width: box, height: box }, aspectRatio: 1 },
      onScanSuccess,
      () => {}
    );
    setScanning(true);
  };

  const startWithCameraId = async (deviceId: string, index: number, list: CameraDevice[]) => {
    setCameraIndex(index);
    setCameras(list);
    await runScanner(deviceId);
  };

  const startScanner = async () => {
    setMessage("");
    setSuccess(false);

    if (needsHttpsForCamera()) {
      setMessage(
        "На телефоні камера доступна лише через HTTPS. Запустіть npm run dev:web:https і відкрийте https://ВАШ_IP:3000"
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Браузер не підтримує доступ до камери.");
      return;
    }

    if (scannerRef.current?.isScanning) return;

    try {
      const list = sortCamerasForQr(await Html5Qrcode.getCameras());
      if (list.length > 0) {
        await startWithCameraId(list[0].id, 0, list);
        return;
      }

      await runScanner({ facingMode: "environment" });
      setCameras([]);
      setCameraIndex(0);
    } catch {
      try {
        await runScanner({ facingMode: "environment" });
        setCameras([]);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setMessage(
          `Не вдалося відкрити камеру: ${detail}. Спробуйте «Фото QR» або дозвіл камери в налаштуваннях.`
        );
      }
    }
  };

  const switchCamera = async () => {
    if (!scannerRef.current?.isScanning) return;

    if (cameras.length < 2) {
      setMessage("Доступна лише одна камера. Спробуйте «Фото QR».");
      return;
    }

    const nextIndex = (cameraIndex + 1) % cameras.length;
    const next = cameras[nextIndex];

    try {
      await scannerRef.current.stop();
      await startWithCameraId(next.id, nextIndex, cameras);
      setMessage(`Активна: ${cameraLabelUa(next, nextIndex, cameras.length)}`);
      setSuccess(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMessage(`Не вдалося перемкнути: ${detail}`);
      setScanning(false);
    }
  };

  const useBackCamera = async () => {
    if (!scannerRef.current) return;

    const list =
      cameras.length > 0 ? cameras : sortCamerasForQr(await Html5Qrcode.getCameras());
    if (list.length === 0) {
      setMessage("Камери не знайдено");
      return;
    }

    const backIdx = list.findIndex((c) => isBackCamera(c.label || ""));
    const idx = backIdx >= 0 ? backIdx : 0;

    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      await startWithCameraId(list[idx].id, idx, list);
      setMessage(`Увімкнено: ${cameraLabelUa(list[idx], idx, list.length)}`);
      setSuccess(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Помилка перемикання");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    setScanning(false);
  };

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage("");
    const elId = "qr-reader";
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(elId, { verbose: false });
    }
    try {
      const decoded = await scannerRef.current.scanFile(file, true);
      onScanSuccess(decoded);
    } catch {
      setMessage("На фото не знайдено QR-код. Зробіть чітке фото екрана з кодом.");
    }
  };

  if (authLoading || !user) return null;

  const httpsUrl =
    typeof window !== "undefined"
      ? `https://${window.location.hostname}:3000/student/scan`
      : "https://ВАШ_IP:3000/student/scan";

  const activeLabel =
    cameras.length > 0
      ? cameraLabelUa(cameras[cameraIndex], cameraIndex, cameras.length)
      : "Задня (авто)";

  return (
    <>
      <Nav />
      <main className="container" style={{ maxWidth: 480 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Відмітка присутності</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
          Наведіть <strong>задню</strong> камеру на QR-код на екрані в аудиторії.
        </p>

        {httpsHint && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            <strong>Телефон + HTTP:</strong> камера не працює без HTTPS.
            <br />
            На ПК: <code>npm run dev:web:https</code>, потім:{" "}
            <a href={httpsUrl}>{httpsUrl}</a>
          </div>
        )}

        {message && (
          <div className={`alert ${success ? "alert-success" : "alert-error"}`}>{message}</div>
        )}

        {scanning && (
          <p style={{ marginBottom: "0.75rem", fontSize: "0.9rem", color: "var(--muted)" }}>
            Зараз: <strong style={{ color: "var(--text)" }}>{activeLabel}</strong>
          </p>
        )}

        <div
          id="qr-reader"
          style={{ width: "100%", marginBottom: "1rem", minHeight: scanning ? 280 : 0 }}
        />

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {!scanning ? (
            <button type="button" className="btn btn-primary" onClick={startScanner}>
              Увімкнути камеру
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={stopScanner}>
                Зупинити
              </button>
              <button type="button" className="btn btn-primary" onClick={useBackCamera}>
                Задня камера
              </button>
              {cameras.length >= 2 && (
                <button type="button" className="btn btn-secondary" onClick={switchCamera}>
                  Перемкнути камеру
                </button>
              )}
            </>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Фото QR
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={onPhotoSelected}
          />
        </div>

        {scanning && cameras.length >= 2 && (
          <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--muted)" }}>
            Якщо бачите себе в кадрі — натисніть <strong>Задня камера</strong> або{" "}
            <strong>Перемкнути камеру</strong>.
          </p>
        )}
      </main>
    </>
  );
}
