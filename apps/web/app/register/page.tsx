"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"STUDENT" | "LECTURER">("STUDENT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({ fullName, email, password, role });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка реєстрації");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Nav />
      <main className="container" style={{ maxWidth: 420, paddingTop: "2rem" }}>
        <h1 style={{ marginBottom: "1.25rem" }}>Реєстрація</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={onSubmit} className="card">
          <div className="field">
            <label className="label">ПІБ</label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label">Пароль (мін. 6 символів)</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="field">
            <label className="label">Роль</label>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as "STUDENT" | "LECTURER")}>
              <option value="STUDENT">Студент</option>
              <option value="LECTURER">Викладач</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Створення…" : "Зареєструватися"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", color: "var(--muted)" }}>
          Вже є акаунт? <Link href="/login">Увійти</Link>
        </p>
      </main>
    </>
  );
}
