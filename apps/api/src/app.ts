import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import coursesRoutes from "./routes/courses";
import sessionsRoutes from "./routes/sessions";
import attendanceRoutes from "./routes/attendance";
import lecturerRoutes from "./routes/lecturer";
import adminRoutes from "./routes/admin";

const app = express();

const isDev = process.env.NODE_ENV !== "production";

const envOrigins =
  process.env.CORS_ORIGIN?.split(",").map((o) => o.trim().replace(/^"|"$/g, "")) ?? [];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (envOrigins.includes(origin)) return true;
  if (/\.vercel\.app$/.test(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
    origin
  );
}

app.use(
  cors({
    origin: isDev
      ? true
      : (origin, callback) => {
          if (isAllowedOrigin(origin)) {
            callback(null, origin ?? true);
          } else {
            callback(null, false);
          }
        },
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "qr-attendance-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/lecturer", lecturerRoutes);
app.use("/api/admin", adminRoutes);
app.use((_req, res) => {
  res.status(404).json({ error: "Маршрут не знайдено" });
});

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Невірний формат даних" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Внутрішня помилка сервера" });
});

export default app;
