"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка входу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Nav />
      <main className="container" style={{ maxWidth: 420, paddingTop: "2rem" }}>
        <h1 style={{ marginBottom: "1.25rem" }}>Вхід</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={onSubmit} className="card">
          <div className="field">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label className="label">Пароль</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Вхід…" : "Увійти"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", color: "var(--muted)" }}>
          Немає облікового запису? <Link href="/register">Зареєструватися</Link>
        </p>
      </main>
    </>
  );
}
