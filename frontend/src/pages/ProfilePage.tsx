import { useState } from "react";
import { api } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { PageHeader } from "../components/PageHeader";
import { useMe } from "../app/state/user";
import { defaultAliasForType, learningLabelFromAlias, learningTypeFromAlias, type LearningAlias } from "../app/labels";
import type { LearningType, Me } from "../types";
import { Caption, Meta, Notice, Divider } from "../components/ui";

function parseApiError(e: unknown): string {
  try {
    const msg = (e as any)?.message ?? String(e);
    const parsed = JSON.parse(msg);
    return parsed.detail ?? parsed.non_field_errors?.[0] ?? msg;
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
    return (
      <div className="notice notice--ok" style={{ marginTop: 0 }}>
        Password changed. Signing you out…
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        className="field"
        type="password"
        placeholder="Current password"
        value={current}
        autoComplete="current-password"
        onChange={(e) => setCurrent(e.target.value)}
      />
      <input
        className="field"
        type="password"
        placeholder="New password (min. 8 characters)"
        value={next}
        autoComplete="new-password"
        onChange={(e) => setNext(e.target.value)}
      />
      <input
        className="field"
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        autoComplete="new-password"
        onChange={(e) => setConfirm(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error ? <div style={{ color: "var(--bad)", fontSize: 13 }}>{error}</div> : null}
      <button className="btn btn--primary" disabled={saving} onClick={submit} style={{ width: "fit-content" }}>
        {saving ? "Saving…" : "Change password"}
      </button>
    </div>
  );
}

export function ProfilePage() {
  const { me, refresh, logout } = useMe();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChangePw, setShowChangePw] = useState(false);

  if (!me) return null;
  const plan = getLearningStylePlan(me.profile);

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

  return (
    <div>
      <PageHeader title="Profile" subtitle="Set your JLPT level and learning style." />

      <div className="grid">
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span className="pill">User: {me.username}</span>
            <span className="pill">Level: {me.profile.jlpt_level}</span>
          </div>

          <Caption style={{ marginTop: 12, display: "block" }}>JLPT level</Caption>
          <div className="toolbar" style={{ marginTop: 10 }}>
            <select
              className="field"
              value={me.profile.jlpt_level}
              disabled={saving}
              onChange={(e) => saveLevel(e.target.value)}
              style={{ maxWidth: 160 }}
            >
              <option value="N5">N5</option>
              <option value="N4">N4</option>
              <option value="N3">N3</option>
              <option value="N2">N2</option>
              <option value="N1">N1</option>
            </select>
          </div>

          <Caption style={{ marginTop: 12, display: "block" }}>Learning type</Caption>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {(
              [
                { alias: "balanced", type: "balanced" as LearningType },
                { alias: "quick_reset", type: "focus_support" as LearningType },
                { alias: "focus_support", type: "focus_support" as LearningType },
                { alias: "calm_structure", type: "calm_structure" as LearningType },
              ] as Array<{ alias: LearningAlias; type: LearningType }>
            ).map(({ alias, type }) => {
              const activeAlias = ((me.profile.ui_prefs as any)?.learning_alias as LearningAlias | undefined) ?? defaultAliasForType(me.profile.learning_type);
              const active = activeAlias === alias;
              return (
                <button
                  key={alias}
                  className={active ? "btn btn--active" : "btn"}
                  disabled={saving}
                  onClick={() => saveLearningType(learningTypeFromAlias(alias), alias)}
                >
                  {learningLabelFromAlias(alias)}
                </button>
              );
            })}
          </div>

          {error ? <div style={{ marginTop: 12, color: "var(--bad)" }}>{error}</div> : null}
          {saving ? <Caption style={{ marginTop: 12, display: "block" }}>Saving...</Caption> : null}

          <Meta style={{ marginTop: 14, display: "block" }}>
            Current plan: {plan.sessionMinutes}-minute sessions, {plan.reminderMinutes}-minute reminders, about {plan.defaultQuestionCount} items per block.
          </Meta>
        </div>

        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__title">Security</div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Change password</div>
              <Meta style={{ marginTop: 3 }}>Update your account password</Meta>
            </div>
            <button
              className="btn"
              onClick={() => setShowChangePw((v) => !v)}
            >
              {showChangePw ? "Cancel" : "Change password"}
            </button>
          </div>

          {showChangePw && (
            <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <ChangePasswordSection
                onPasswordChanged={() => {
                  setShowChangePw(false);
                  logout();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
