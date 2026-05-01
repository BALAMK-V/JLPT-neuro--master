import { useEffect, useState } from "react";
import { apiNoAuth } from "../app/api/client";
import { useMe } from "../app/state/user";

type AuthView = "login" | "register" | "forgot" | "sent" | "reset";

function parseApiError(e: unknown): string {
  try {
    const msg = (e as any)?.message ?? String(e);
    const parsed = JSON.parse(msg);
    return parsed.detail ?? parsed.non_field_errors?.[0] ?? msg;
  } catch {
    return String((e as any)?.message ?? e);
  }
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  id,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-input-wrap">
      <input
        id={id}
        type={show ? "text" : "password"}
        className="auth-field"
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="auth-eye"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

function LoginView({
  onRegister,
  onForgot,
}: {
  onRegister: () => void;
  onForgot: () => void;
}) {
  const { login } = useMe();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("Test@123");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-view">
      <div className="auth-view__head">
        <h1 className="auth-view__title">Welcome back</h1>
        <p className="auth-view__sub">Sign in to continue your Japanese study</p>
      </div>

      <div className="auth-fields">
        <div className="auth-field-group">
          <label className="auth-label" htmlFor="login-user">Username</label>
          <input
            id="login-user"
            className="auth-field"
            placeholder="Enter username"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        <div className="auth-field-group">
          <div className="auth-label-row">
            <label className="auth-label" htmlFor="login-pass">Password</label>
            <button type="button" className="auth-link" onClick={onForgot}>
              Forgot password?
            </button>
          </div>
          <PasswordInput
            id="login-pass"
            value={password}
            onChange={setPassword}
            placeholder="Enter password"
            autoComplete="current-password"
          />
        </div>
      </div>

      {error ? <div className="auth-error">{error}</div> : null}

      <button
        className="auth-submit"
        disabled={busy || !username.trim() || !password}
        onClick={submit}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>

      <div className="auth-demo-hint">
        Demo account: <span className="auth-chip">demo</span> / <span className="auth-chip">Test@123</span>
      </div>

      <div className="auth-switch">
        Don't have an account?{" "}
        <button type="button" className="auth-link" onClick={onRegister}>
          Create account
        </button>
      </div>

      <div className="auth-admin-link">
        <a href="/admin/" className="auth-link auth-link--muted">
          Django Admin Panel →
        </a>
      </div>
    </div>
  );
}

function RegisterView({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await apiNoAuth("/auth/register/", "POST", {
        username: username.trim(),
        email: email.trim() || undefined,
        password,
      });
      setDone(true);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="auth-view">
        <div className="auth-success-state">
          <div className="auth-success-icon">✓</div>
          <h2 className="auth-view__title">Account created!</h2>
          <p className="auth-view__sub">Your account is ready. Sign in to start studying.</p>
          <button className="auth-submit" onClick={onLogin}>Go to Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-view">
      <div className="auth-view__head">
        <h1 className="auth-view__title">Create account</h1>
        <p className="auth-view__sub">Join JLPT Neuro Master and start learning</p>
      </div>

      <div className="auth-fields">
        <div className="auth-field-group">
          <label className="auth-label" htmlFor="reg-user">Username <span className="auth-required">*</span></label>
          <input
            id="reg-user"
            className="auth-field"
            placeholder="Choose a username"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="auth-field-group">
          <label className="auth-label" htmlFor="reg-email">
            Email <span className="auth-optional">(optional)</span>
          </label>
          <input
            id="reg-email"
            className="auth-field"
            type="email"
            placeholder="your@email.com"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <span className="auth-hint">Needed only for password recovery</span>
        </div>

        <div className="auth-field-group">
          <label className="auth-label" htmlFor="reg-pass">Password <span className="auth-required">*</span></label>
          <PasswordInput
            id="reg-pass"
            value={password}
            onChange={setPassword}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
          />
        </div>

        <div className="auth-field-group">
          <label className="auth-label" htmlFor="reg-confirm">Confirm password <span className="auth-required">*</span></label>
          <PasswordInput
            id="reg-confirm"
            value={confirm}
            onChange={setConfirm}
            placeholder="Repeat password"
            autoComplete="new-password"
          />
        </div>
      </div>

      {error ? <div className="auth-error">{error}</div> : null}

      <button
        className="auth-submit"
        disabled={busy || !username.trim() || !password || !confirm}
        onClick={submit}
      >
        {busy ? "Creating account…" : "Create account"}
      </button>

      <div className="auth-switch">
        Already have an account?{" "}
        <button type="button" className="auth-link" onClick={onLogin}>
          Sign in
        </button>
      </div>
    </div>
  );
}

function ForgotView({
  onBack,
  onSent,
}: {
  onBack: () => void;
  onSent: (devToken?: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) { setError("Email is required."); return; }
    setError(null);
    setBusy(true);
    try {
      const res = await apiNoAuth<{ detail: string; dev_token?: string }>(
        "/auth/forgot-password/",
        "POST",
        { email: email.trim() }
      );
      onSent(res.dev_token);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-view">
      <button type="button" className="auth-back" onClick={onBack}>
        ← Back to sign in
      </button>

      <div className="auth-view__head">
        <h1 className="auth-view__title">Forgot password?</h1>
        <p className="auth-view__sub">
          Enter the email linked to your account and we'll send reset instructions.
        </p>
      </div>

      <div className="auth-fields">
        <div className="auth-field-group">
          <label className="auth-label" htmlFor="forgot-email">Email address</label>
          <input
            id="forgot-email"
            className="auth-field"
            type="email"
            placeholder="your@email.com"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
      </div>

      {error ? <div className="auth-error">{error}</div> : null}

      <button className="auth-submit" disabled={busy || !email.trim()} onClick={submit}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </div>
  );
}

function SentView({
  devToken,
  onBack,
  onUseDevToken,
}: {
  devToken?: string;
  onBack: () => void;
  onUseDevToken: (uid: string, token: string) => void;
}) {
  const handleDevReset = () => {
    if (!devToken) return;
    const [uid, token] = devToken.split(":");
    if (uid && token) onUseDevToken(uid, token);
  };

  return (
    <div className="auth-view">
      <div className="auth-success-state">
        <div className="auth-success-icon">✉</div>
        <h2 className="auth-view__title">Check your email</h2>
        <p className="auth-view__sub">
          If an account is linked to that address, reset instructions have been sent.
        </p>

        {devToken ? (
          <div className="auth-dev-box">
            <div className="auth-dev-box__label">Development mode — no email sent</div>
            <button type="button" className="auth-submit auth-submit--outline" onClick={handleDevReset}>
              Click here to reset password now
            </button>
          </div>
        ) : null}

        <button type="button" className="auth-link" style={{ marginTop: 16 }} onClick={onBack}>
          ← Back to sign in
        </button>
      </div>
    </div>
  );
}

function ResetView({
  uid,
  token,
  onDone,
}: {
  uid: string;
  token: string;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      await apiNoAuth("/auth/reset-password/", "POST", { uid, token, new_password: password });
      setDone(true);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="auth-view">
        <div className="auth-success-state">
          <div className="auth-success-icon">✓</div>
          <h2 className="auth-view__title">Password reset!</h2>
          <p className="auth-view__sub">Your new password has been saved. Sign in to continue.</p>
          <button className="auth-submit" onClick={onDone}>Go to Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-view">
      <div className="auth-view__head">
        <h1 className="auth-view__title">Set new password</h1>
        <p className="auth-view__sub">Choose a strong password for your account.</p>
      </div>

      <div className="auth-fields">
        <div className="auth-field-group">
          <label className="auth-label" htmlFor="reset-pass">New password</label>
          <PasswordInput
            id="reset-pass"
            value={password}
            onChange={setPassword}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
          />
        </div>

        <div className="auth-field-group">
          <label className="auth-label" htmlFor="reset-confirm">Confirm new password</label>
          <PasswordInput
            id="reset-confirm"
            value={confirm}
            onChange={setConfirm}
            placeholder="Repeat password"
            autoComplete="new-password"
          />
        </div>
      </div>

      {error ? <div className="auth-error">{error}</div> : null}

      <button
        className="auth-submit"
        disabled={busy || !password || !confirm}
        onClick={submit}
      >
        {busy ? "Saving…" : "Set new password"}
      </button>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="auth-brand">
      <div className="auth-brand__deco" aria-hidden>語</div>

      <div className="auth-brand__content">
        <div className="auth-brand__logo">
          <span className="auth-brand__jp">日本語</span>
          <span className="auth-brand__en">JLPT Neuro Master</span>
        </div>

        <p className="auth-brand__tagline">
          Master Japanese with neural intelligence
        </p>

        <ul className="auth-brand__features">
          <li><span className="auth-feat-dot" />Spaced repetition flashcards (SM-2 &amp; FSRS)</li>
          <li><span className="auth-feat-dot" />JLPT N5–N1 exam preparation</li>
          <li><span className="auth-feat-dot" />AI grammar check &amp; sentence mining</li>
          <li><span className="auth-feat-dot" />Listening, Reading &amp; Speaking practice</li>
          <li><span className="auth-feat-dot" />Neuro-adaptive learning profiles</li>
        </ul>
      </div>

      <div className="auth-brand__levels">
        {["N5", "N4", "N3", "N2", "N1"].map((n) => (
          <span key={n} className="auth-level-badge">{n}</span>
        ))}
      </div>
    </div>
  );
}

export function AuthPage() {
  const [view, setView] = useState<AuthView>("login");
  const [resetUid, setResetUid] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [devToken, setDevToken] = useState<string | undefined>();

  // Check URL query params for reset link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get("reset");
    if (reset) {
      const [uid, token] = reset.split(":");
      if (uid && token) {
        setResetUid(uid);
        setResetToken(token);
        setView("reset");
      }
    }
  }, []);

  const handleSent = (dt?: string) => {
    setDevToken(dt);
    setView("sent");
  };

  const handleUseDevToken = (uid: string, token: string) => {
    setResetUid(uid);
    setResetToken(token);
    setView("reset");
  };

  return (
    <div className="auth-page">
      <BrandPanel />

      <div className="auth-form-panel">
        <div className="auth-form-inner">
          {view === "login" && (
            <LoginView
              onRegister={() => setView("register")}
              onForgot={() => setView("forgot")}
            />
          )}
          {view === "register" && (
            <RegisterView onLogin={() => setView("login")} />
          )}
          {view === "forgot" && (
            <ForgotView onBack={() => setView("login")} onSent={handleSent} />
          )}
          {view === "sent" && (
            <SentView
              devToken={devToken}
              onBack={() => setView("login")}
              onUseDevToken={handleUseDevToken}
            />
          )}
          {view === "reset" && (
            <ResetView
              uid={resetUid}
              token={resetToken}
              onDone={() => setView("login")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
