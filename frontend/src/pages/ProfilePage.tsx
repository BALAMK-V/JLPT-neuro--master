import { useState } from "react";
import { api } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { PageHeader } from "../components/PageHeader";
import { useMe } from "../app/state/user";
import { defaultAliasForType, learningLabelFromAlias, learningTypeFromAlias, type LearningAlias } from "../app/labels";
import type { LearningType, Me } from "../types";

export function ProfilePage() {
  const { me, refresh } = useMe();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

          <div style={{ marginTop: 12, color: "rgba(255,255,255,0.75)" }}>JLPT level</div>
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

          <div style={{ marginTop: 12, color: "rgba(255,255,255,0.75)" }}>Learning type</div>
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

          {error ? <div style={{ marginTop: 12, color: "rgba(255,92,122,0.95)" }}>{error}</div> : null}
          {saving ? <div style={{ marginTop: 12, color: "rgba(255,255,255,0.65)" }}>Saving...</div> : null}

          <div style={{ marginTop: 14, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            Current plan: {plan.sessionMinutes}-minute sessions, {plan.reminderMinutes}-minute reminders, about {plan.defaultQuestionCount} items per block.
          </div>
        </div>
      </div>
    </div>
  );
}
