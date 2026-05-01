import { useEffect, useState } from "react";
import { api } from "../app/api/client";
import { PageHeader } from "../components/PageHeader";

type ManagedUser = {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string | null;
  last_login: string | null;
  jlpt_level: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function parseApiError(e: unknown): string {
  try {
    const msg = (e as any)?.message ?? String(e);
    const parsed = JSON.parse(msg);
    return parsed.detail ?? msg;
  } catch {
    return String((e as any)?.message ?? e);
  }
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (u: ManagedUser) => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const user = await api<ManagedUser>("/auth/users/", "POST", {
        username: username.trim(),
        email: email.trim(),
        password,
        is_staff: isStaff,
      });
      onCreated(user);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <div className="um-modal" onClick={(e) => e.stopPropagation()}>
        <div className="um-modal__header">
          <div className="um-modal__title">Create User</div>
          <button className="btn" onClick={onClose} style={{ padding: "4px 10px" }}>✕</button>
        </div>

        <div className="um-modal__body">
          <label className="um-label">Username</label>
          <input
            className="field"
            placeholder="username"
            value={username}
            autoComplete="off"
            onChange={(e) => setUsername(e.target.value)}
          />

          <label className="um-label" style={{ marginTop: 12 }}>Email (optional)</label>
          <input
            className="field"
            type="email"
            placeholder="user@example.com"
            value={email}
            autoComplete="off"
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="um-label" style={{ marginTop: 12 }}>Password</label>
          <input
            className="field"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="um-checkbox-row" style={{ marginTop: 14 }}>
            <input
              type="checkbox"
              checked={isStaff}
              onChange={(e) => setIsStaff(e.target.checked)}
            />
            <span>Management user (can access imports, paper upload, user management)</span>
          </label>

          {error ? <div className="um-error">{error}</div> : null}
        </div>

        <div className="um-modal__footer">
          <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create user"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onUpdated,
  onDeleted,
}: {
  user: ManagedUser;
  onClose: () => void;
  onUpdated: (u: ManagedUser) => void;
  onDeleted: (id: number) => void;
}) {
  const [isStaff, setIsStaff] = useState(user.is_staff);
  const [isActive, setIsActive] = useState(user.is_active);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setError(null);
    if (newPassword && newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { is_staff: isStaff, is_active: isActive };
      if (newPassword) body.new_password = newPassword;
      const updated = await api<ManagedUser>(`/auth/users/${user.id}/`, "PATCH", body);
      onUpdated(updated);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    setSaving(true);
    try {
      await api(`/auth/users/${user.id}/`, "DELETE");
      onDeleted(user.id);
    } catch (e) {
      setError(parseApiError(e));
      setSaving(false);
    }
  };

  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <div className="um-modal" onClick={(e) => e.stopPropagation()}>
        <div className="um-modal__header">
          <div className="um-modal__title">Edit — {user.username}</div>
          <button className="btn" onClick={onClose} style={{ padding: "4px 10px" }}>✕</button>
        </div>

        <div className="um-modal__body">
          <div className="um-user-meta">
            <span>Joined: {formatDate(user.date_joined)}</span>
            <span>Last login: {formatDate(user.last_login)}</span>
            <span>Level: {user.jlpt_level}</span>
          </div>

          <label className="um-checkbox-row" style={{ marginTop: 14 }}>
            <input type="checkbox" checked={isStaff} onChange={(e) => setIsStaff(e.target.checked)} />
            <span>Management user</span>
          </label>

          <label className="um-checkbox-row" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Active (can sign in)</span>
          </label>

          <label className="um-label" style={{ marginTop: 14 }}>Reset password (leave blank to keep current)</label>
          <input
            className="field"
            type="password"
            placeholder="New password (min. 8 characters)"
            value={newPassword}
            autoComplete="new-password"
            onChange={(e) => setNewPassword(e.target.value)}
          />

          {error ? <div className="um-error">{error}</div> : null}

          {confirmDelete ? (
            <div className="um-delete-confirm">
              <span>Delete <strong>{user.username}</strong>? This is permanent.</span>
              <button className="btn btn--danger" onClick={del} disabled={saving}>
                {saving ? "Deleting…" : "Yes, delete"}
              </button>
              <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          ) : null}
        </div>

        <div className="um-modal__footer">
          <button
            className="btn btn--danger"
            onClick={() => setConfirmDelete(true)}
            disabled={saving || confirmDelete}
            style={{ marginRight: "auto" }}
          >
            Delete user
          </button>
          <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UserManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ManagedUser[]>("/auth/users/");
      setUsers(data);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalUsers = users.length;
  const managementCount = users.filter((u) => u.is_staff).length;
  const activeCount = users.filter((u) => u.is_active).length;

  return (
    <div>
      <PageHeader title="User Management" subtitle="Manage user accounts and roles." />

      <div className="grid">
        {/* Stats row */}
        <div className="card um-stat-card" style={{ gridColumn: "span 4" }}>
          <div className="um-stat__value">{totalUsers}</div>
          <div className="um-stat__label">Total users</div>
        </div>
        <div className="card um-stat-card" style={{ gridColumn: "span 4" }}>
          <div className="um-stat__value">{managementCount}</div>
          <div className="um-stat__label">Management</div>
        </div>
        <div className="card um-stat-card" style={{ gridColumn: "span 4" }}>
          <div className="um-stat__value">{activeCount}</div>
          <div className="um-stat__label">Active</div>
        </div>

        {/* Main table card */}
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="um-toolbar">
            <input
              className="field"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 280 }}
            />
            <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
              + Create user
            </button>
          </div>

          {error ? (
            <div className="notice notice--bad" style={{ margin: "12px 0 0" }}>{error}</div>
          ) : null}

          {loading ? (
            <div className="um-loading">Loading users…</div>
          ) : filtered.length === 0 ? (
            <div className="um-empty">No users found.</div>
          ) : (
            <div className="um-table-wrap">
              <table className="um-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Level</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Last login</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className={!u.is_active ? "um-row--inactive" : undefined}>
                      <td className="um-cell--username">{u.username}</td>
                      <td className="um-cell--email">{u.email || "—"}</td>
                      <td>
                        <span className={u.is_staff ? "um-badge um-badge--mgmt" : "um-badge um-badge--user"}>
                          {u.is_staff ? "Management" : "User"}
                        </span>
                      </td>
                      <td>{u.jlpt_level}</td>
                      <td>
                        <span className={u.is_active ? "um-badge um-badge--active" : "um-badge um-badge--inactive"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="um-cell--date">{formatDate(u.date_joined)}</td>
                      <td className="um-cell--date">{formatDate(u.last_login)}</td>
                      <td>
                        <button
                          className="btn"
                          style={{ padding: "4px 12px", fontSize: 12 }}
                          onClick={() => setEditUser(u)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(u) => {
            setUsers((prev) => [...prev, u]);
            setShowCreate(false);
          }}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onUpdated={(u) => {
            setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)));
            setEditUser(null);
          }}
          onDeleted={(id) => {
            setUsers((prev) => prev.filter((x) => x.id !== id));
            setEditUser(null);
          }}
        />
      )}
    </div>
  );
}
