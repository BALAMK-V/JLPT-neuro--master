import { useState } from "react";
import { api } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { PageHeader } from "../components/PageHeader";
import { useMe } from "../app/state/user";
import { defaultAliasForType, learningLabelFromAlias, learningTypeFromAlias, type LearningAlias } from "../app/labels";
import type { LearningType, Me } from "../types";
import { Caption, CustomSelect, Meta } from "../components/ui";

function parseApiError(e: unknown): string {
  try {
    const msg = (e as any)?.message ?? String(e);
    const parsed = JSON.parse(msg);
    return parsed.detail ?? parsed.non_field_errors?.[0] ?? String(Object.values(parsed)[0]) ?? msg;
  } catch {
    return String((e as any)?.message ?? e);
  }
}

function ChangePasswordSection({ onPasswordChanged }: { onPasswordChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    setError(null);
    if (!current || !next) { setError("All fields are required."); return; }
    if (next.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setError("New passwords do not match."); return; }
    setSaving(true);
    try {
      await api("/auth/change-password/", "POST", { current_password: current, new_password: next });
      setSuccess(true);
      setTimeout(() => onPasswordChanged(), 1500);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return <div className="notice notice--ok" style={{ marginTop: 0 }}>Password changed. Signing you out…</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input className="field" type="password" placeholder="Current password" value={current} autoComplete="current-password" onChange={(e) => setCurrent(e.target.value)} />
      <input className="field" type="password" placeholder="New password (min. 8 characters)" value={next} autoComplete="new-password" onChange={(e) => setNext(e.target.value)} />
      <input className="field" type="password" placeholder="Confirm new password" value={confirm} autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      {error ? <div style={{ color: "var(--bad)", fontSize: 13 }}>{error}</div> : null}
      <button className="btn btn--primary" disabled={saving} onClick={submit} style={{ width: "fit-content" }}>
        {saving ? "Saving…" : "Change password"}
      </button>
    </div>
  );
}

export function ProfilePage() {
  const { me, refresh, logout } = useMe();

  // Account info edit state
  const [accountEdit, setAccountEdit] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState(false);

  // Study prefs
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);
  const [prefSuccess, setPrefSuccess] = useState(false);

  // Learning type / JLPT
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Security
  const [showChangePw, setShowChangePw] = useState(false);

  if (!me) return null;
  const plan = getLearningStylePlan(me.profile);

  const displayName = [me.first_name, me.last_name].filter(Boolean).join(" ") || me.username;
  const initials = (me.first_name && me.last_name)
    ? `${me.first_name[0]}${me.last_name[0]}`.toUpperCase()
    : me.username.slice(0, 2).toUpperCase();

  const openAccountEdit = () => {
    setFirstName(me.first_name || "");
    setLastName(me.last_name || "");
    setEmail(me.email || "");
    setAccountError(null);
    setAccountSuccess(false);
    setAccountEdit(true);
  };

  const saveAccount = async () => {
    setAccountSaving(true);
    setAccountError(null);
    try {
      await api<Me>("/auth/me/", "PATCH", { first_name: firstName, last_name: lastName, email });
      await refresh();
      setAccountSuccess(true);
      setTimeout(() => { setAccountSuccess(false); setAccountEdit(false); }, 1500);
    } catch (e) {
      setAccountError(parseApiError(e));
    } finally {
      setAccountSaving(false);
    }
  };

  const saveStudyPrefs = async (updates: Partial<{
    daily_goal_new_items: number;
    reminders_enabled: boolean;
    reminder_interval_minutes: number;
  }>) => {
    setPrefSaving(true);
    setPrefError(null);
    try {
      await api<Me>("/auth/me/", "PATCH", { profile: updates });
      await refresh();
      setPrefSuccess(true);
      setTimeout(() => setPrefSuccess(false), 2000);
    } catch (e) {
      setPrefError(parseApiError(e));
    } finally {
      setPrefSaving(false);
    }
  };

  const saveLearningType = async (learning_type: LearningType, learning_alias?: LearningAlias) => {
    setSaving(true);
    setError(null);
    try {
      const ui_prefs = { ...(me.profile.ui_prefs || {}) } as any;
      if (learning_alias) ui_prefs.learning_alias = learning_alias;
      ui_prefs.reduced_motion = learning_alias === "calm_structure";
      ui_prefs.complexity = learning_alias === "calm_structure" ? "low" : learning_alias === "balanced" ? "standard" : "medium";
      const nextPlan = getLearningStylePlan({ ...me.profile, learning_type, ui_prefs });
      await api<Me>("/auth/me/", "PATCH", {
        profile: {
          learning_type,
          session_minutes_preference: nextPlan.sessionMinutes,
          reminder_interval_minutes: nextPlan.reminderMinutes,
          ui_prefs,
        },
      });
      await refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const saveLevel = async (jlpt_level: string) => {
    setSaving(true);
    setError(null);
    try {
      await api<Me>("/auth/me/", "PATCH", { profile: { jlpt_level } });
      await refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const activeAlias = ((me.profile.ui_prefs as any)?.learning_alias as LearningAlias | undefined)
    ?? defaultAliasForType(me.profile.learning_type);

  return (
    <div>
      <PageHeader title="Profile" subtitle="Manage your account, study preferences and learning style." />

      <div className="grid">

        {/* ── Profile header ── */}
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div className="profile-avatar">{initials}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{displayName}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>@{me.username}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <span className="pill">{me.profile.jlpt_level}</span>
                <span className="pill">{plan.sessionMinutes}-min sessions</span>
                {me.is_staff && <span className="pill pill--management">Management</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Account info ── */}
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="card__title" style={{ marginBottom: 0 }}>Account Info</div>
            {!accountEdit && <button className="btn" onClick={openAccountEdit}>Edit</button>}
          </div>

          {!accountEdit ? (
            <div style={{ display: "grid", gap: 8 }}>
              {[
                ["Username", me.username],
                ["Email", me.email || "—"],
                ["First name", me.first_name || "—"],
                ["Last name", me.last_name || "—"],
              ].map(([label, value]) => (
                <div key={label} className="profile-field-row">
                  <span className="profile-field-label">{label}</span>
                  <span className="profile-field-value">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Caption style={{ display: "block", marginBottom: 4 }}>First name</Caption>
                  <input className="field" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                </div>
                <div>
                  <Caption style={{ display: "block", marginBottom: 4 }}>Last name</Caption>
                  <input className="field" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                </div>
              </div>
              <div>
                <Caption style={{ display: "block", marginBottom: 4 }}>Email</Caption>
                <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
              </div>
              {accountError && <div style={{ color: "var(--bad)", fontSize: 13 }}>{accountError}</div>}
              {accountSuccess && <div style={{ color: "var(--ok)", fontSize: 13 }}>Saved successfully!</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn--primary" disabled={accountSaving} onClick={saveAccount}>
                  {accountSaving ? "Saving…" : "Save changes"}
                </button>
                <button className="btn" disabled={accountSaving} onClick={() => setAccountEdit(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Study preferences ── */}
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__title" style={{ marginBottom: 16 }}>Study Preferences</div>

          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <Caption style={{ display: "block", marginBottom: 6 }}>JLPT Target Level</Caption>
              <CustomSelect
                value={me.profile.jlpt_level}
                onChange={(e) => saveLevel(e.target.value)}
                style={{ maxWidth: 160 }}
              >
                {["N5", "N4", "N3", "N2", "N1"].map((l) => <option key={l} value={l}>{l}</option>)}
              </CustomSelect>
            </div>

            <div>
              <Caption style={{ display: "block", marginBottom: 6 }}>Daily goal — new items</Caption>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={me.profile.daily_goal_new_items}
                  disabled={prefSaving}
                  style={{ maxWidth: 90 }}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v >= 1 && v <= 100) saveStudyPrefs({ daily_goal_new_items: v });
                  }}
                />
                <Meta>items per day</Meta>
              </div>
            </div>

            <div>
              <Caption style={{ display: "block", marginBottom: 8 }}>Study reminders</Caption>
              <label className="profile-toggle-label">
                <input
                  type="checkbox"
                  checked={me.profile.reminders_enabled}
                  disabled={prefSaving}
                  onChange={(e) => saveStudyPrefs({ reminders_enabled: e.target.checked })}
                />
                <span>Enable study reminders</span>
              </label>
              {me.profile.reminders_enabled && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <Caption>Interval</Caption>
                  <CustomSelect
                    value={String(me.profile.reminder_interval_minutes)}
                    onChange={(e) => saveStudyPrefs({ reminder_interval_minutes: parseInt(e.target.value) })}
                    style={{ maxWidth: 180 }}
                  >
                    <option value={30}>Every 30 minutes</option>
                    <option value={60}>Every 1 hour</option>
                    <option value={120}>Every 2 hours</option>
                    <option value={240}>Every 4 hours</option>
                    <option value={480}>Every 8 hours</option>
                  </CustomSelect>
                </div>
              )}
            </div>
          </div>

          {prefError && <div style={{ color: "var(--bad)", fontSize: 13, marginTop: 10 }}>{prefError}</div>}
          {prefSuccess && <div style={{ color: "var(--ok)", fontSize: 13, marginTop: 10 }}>Saved!</div>}

          <Meta style={{ display: "block", marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            Active plan: {plan.sessionMinutes}-min sessions · {plan.reminderMinutes}-min reminder interval · ~{plan.defaultQuestionCount} items per block
          </Meta>
        </div>

        {/* ── Learning style ── */}
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__title" style={{ marginBottom: 4 }}>Learning Style</div>
          <Meta style={{ display: "block", marginBottom: 14 }}>Choose how the app adapts to your study rhythm.</Meta>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(
              [
                { alias: "balanced", label: "Balanced", desc: "25-min sessions, standard flow" },
                { alias: "quick_reset", label: "Quick Reset", desc: "10-min bursts, fast resets" },
                { alias: "focus_support", label: "Focus Support", desc: "15-min sessions, focus cues" },
                { alias: "calm_structure", label: "Calm Structure", desc: "20-min sessions, reduced motion" },
              ] as Array<{ alias: LearningAlias; label: string; desc: string }>
            ).map(({ alias, label, desc }) => {
              const active = activeAlias === alias;
              return (
                <button
                  key={alias}
                  className={active ? "btn btn--active profile-style-btn" : "btn profile-style-btn"}
                  disabled={saving}
                  onClick={() => saveLearningType(learningTypeFromAlias(alias), alias)}
                  title={desc}
                >
                  {active && <span style={{ marginRight: 6 }}>✓</span>}
                  {label}
                </button>
              );
            })}
          </div>
          {error && <div style={{ marginTop: 12, color: "var(--bad)" }}>{error}</div>}
          {saving && <Caption style={{ marginTop: 8, display: "block" }}>Saving…</Caption>}
        </div>

        {/* ── Security ── */}
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__title">Security</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Change password</div>
              <Meta style={{ marginTop: 3 }}>Update your account password</Meta>
            </div>
            <button className="btn" onClick={() => setShowChangePw((v) => !v)}>
              {showChangePw ? "Cancel" : "Change password"}
            </button>
          </div>
          {showChangePw && (
            <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <ChangePasswordSection onPasswordChanged={() => { setShowChangePw(false); logout(); }} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
