import { useState } from "react";
import { useMe } from "../app/state/user";

export function LoginForm() {
  const { login } = useMe();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("Test@123");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card auth" style={{ gridColumn: "span 12" }}>
      <div className="card__title">Sign in</div>
      <div style={{ color: "rgba(255,255,255,0.7)", marginBottom: 14 }}>
        Seeded demo is ready. You can change credentials later.
      </div>

      <div className="form">
        <label className="label">
          <span className="label__text">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="field"
            autoComplete="username"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>

        <label className="label">
          <span className="label__text">Password</span>
          <div className="fieldrow">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              autoComplete="current-password"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button className="btn" type="button" onClick={() => setShow((v) => !v)} style={{ padding: "10px 12px" }}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {error ? <div className="error">{error}</div> : null}

        <div className="actions">
          <button className="btn btn--primary" disabled={loading} onClick={submit}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
        Seeded: <span className="pill">demo</span> / <span className="pill">Test@123</span>
      </div>
    </div>
  );
}
