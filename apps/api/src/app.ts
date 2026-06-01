import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import coursesRoutes from "./routes/courses";
import sessionsRoutes from "./routes/sessions";
import attendanceRoutes from "./routes/attendance";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
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

app.use((_req, res) => {
  res.status(404).json({ error: "Маршрут не знайдено" });
});

export default app;
