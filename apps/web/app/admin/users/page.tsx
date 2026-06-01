"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { AdminNav } from "@/components/AdminNav";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { roleLabel } from "@/lib/roles";

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  deviceHash: string | null;
  _count: { enrollments: number; courses: number };
};

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  useEffect(() => {
    if (!loading && user?.role !== "ADMIN") router.replace("/login");
  }, [user, loading, router]);

  const load = () =>
    api<{ users: UserRow[] }>("/api/admin/users").then((u) => setUsers(u.users));

  useEffect(() => {
    if (user?.role === "ADMIN") load().catch((e) => setError(e.message));
  }, [user]);

  const startEditCredentials = (u: UserRow) => {
    setEditingId(u.id);
    setEditEmail(u.email);
    setEditPassword("");
    setError("");
  };

  const saveCredentials = async (userId: string) => {
    setError("");
    const u = users.find((x) => x.id === userId);
    const body: { email?: string; password?: string } = {};
    if (editEmail.trim() && editEmail.trim() !== u?.email) body.email = editEmail.trim();
    if (editPassword) body.password = editPassword;
    if (!body.email && !body.password) {
      setError("Змініть email або вкажіть новий пароль");
      return;
    }
    try {
      await api(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditingId(null);
      setEditPassword("");
      setMessage("Збережено");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  const changeRole = async (userId: string, role: string) => {
    setError("");
    try {
      await api(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  const resetDevice = async (userId: string, name: string) => {
    if (!confirm(`Скинути прив'язку пристрою для ${name}?`)) return;
    setError("");
    try {
      await api(`/api/admin/users/${userId}/reset-device`, { method: "POST" });
      setMessage("Пристрій скинуто");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  if (loading || !user) return null;

  return (
    <>
      <Nav />
      <AdminNav />
      <main className="container">
        <h1 style={{ marginBottom: "1rem" }}>Користувачі</h1>
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <div className="card" style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>ПІБ</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Пристрій</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <Fragment key={u.id}>
                  <tr>
                    <td>{u.fullName}</td>
                    <td>{u.email}</td>
                    <td>{roleLabel(u.role)}</td>
                    <td>
                      {u.role === "STUDENT"
                        ? u.deviceHash
                          ? "Прив'язано"
                          : "—"
                        : "—"}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <select
                        className="select"
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        style={{ maxWidth: 140, marginRight: "0.35rem" }}
                      >
                        <option value="STUDENT">Студент</option>
                        <option value="LECTURER">Викладач</option>
                        <option value="ADMIN">Адмін</option>
                      </select>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ marginRight: "0.35rem" }}
                        onClick={() =>
                          editingId === u.id ? setEditingId(null) : startEditCredentials(u)
                        }
                      >
                        Логін / пароль
                      </button>
                      {u.role === "STUDENT" && u.deviceHash && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => resetDevice(u.id, u.fullName)}
                        >
                          Скинути пристрій
                        </button>
                      )}
                    </td>
                  </tr>
                  {editingId === u.id && (
                    <tr>
                      <td colSpan={5} style={{ background: "var(--bg)" }}>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.75rem",
                            alignItems: "flex-end",
                          }}
                        >
                          <div className="field" style={{ flex: "1 1 200px", margin: 0 }}>
                            <label htmlFor={`email-${u.id}`}>Email</label>
                            <input
                              id={`email-${u.id}`}
                              className="input"
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                            />
                          </div>
                          <div className="field" style={{ flex: "1 1 200px", margin: 0 }}>
                            <label htmlFor={`pwd-${u.id}`}>Новий пароль</label>
                            <input
                              id={`pwd-${u.id}`}
                              className="input"
                              type="password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              placeholder="мін. 6 символів"
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => saveCredentials(u.id)}
                          >
                            Зберегти
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
