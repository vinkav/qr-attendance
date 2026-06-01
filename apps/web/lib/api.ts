/** У браузері — той самий origin (Next проксує /api на бекенд). */
export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}${path}`, { ...options, headers });
  } catch {
    throw new Error(
      `Не вдалося з’єднатися з API (${getApiUrl()}). Запустіть на ПК: npm run dev:api`
    );
  }
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (data as { error?: string }).error;
    throw new Error(msg ?? `Помилка запиту (${res.status})`);
  }
  return data as T;
}

export function getDeviceHash(): string {
  if (typeof window === "undefined") return "server";
  const key = "device_hash";
  let hash = localStorage.getItem(key);
  if (!hash) {
    const raw = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
    ].join("|");
    hash = btoa(raw).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
    localStorage.setItem(key, hash);
  }
  return hash;
}

export async function downloadCourseReport(courseId: string, from: string, to: string) {
  const token = getToken();
  const q = new URLSearchParams({ from, to });
  const res = await fetch(`${getApiUrl()}/api/courses/${courseId}/report.csv?${q}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Не вдалося завантажити звіт");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `course-report-${from}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadCsv(sessionId: string) {
  const token = getToken();
  const res = await fetch(`${getApiUrl()}/api/sessions/${sessionId}/report.csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Не вдалося завантажити звіт");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vidviduvannist-${sessionId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
