"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHECK_IN_DAYS,
  createWeeklyCheckInCalendar,
  type CheckInDay,
} from "@/lib/check-in-calendar";

type Step = {
  id: string;
  goal_id: string;
  goal_text: string;
  text: string;
  minutes: number;
  week_start: string;
  status: "pending" | "done" | "skipped";
  shrink_count: number;
};

type Goal = { id: string; text: string };

type ExtractionResponse = {
  goals?: unknown;
  error?: string;
};

export default function Home() {
  // Keep every hook at the top level of the component.
  const [goals, setGoals] = useState<Goal[]>([]);
  const [step, setStep] = useState<Step | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [extractedGoals, setExtractedGoals] = useState<string[]>([]);
  const [screen, setScreen] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [extractStatus, setExtractStatus] = useState<"uploading" | "processing" | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [hasScanned, setHasScanned] = useState(false);
  const [checkInDay, setCheckInDay] = useState<CheckInDay>("SU");

  useEffect(() => {
    let cancelled = false;

    async function loadGoals() {
      try {
        const response = await fetch("/api/goals");
        if (!response.ok) throw new Error("Could not load goals");

        const data = await response.json();
        if (!cancelled) {
          const saved = Array.isArray(data.goals) ? data.goals : [];
          setGoals(saved);
          setStep(data.step ?? null);
          setSelectedGoalId(data.step?.goal_id ?? data.suggestedGoalId ?? saved[0]?.id ?? "");
          if (saved.length > 0) setScreen(2); // return to saved goals
        }
      } catch {
        if (!cancelled) {
          setMessage("Couldn't load your saved goals. Please refresh.");
        }
      }
    }

    void loadGoals();
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/goals");
      if (!response.ok) throw new Error("Could not load goals");

      const data = await response.json();
      const saved = Array.isArray(data.goals) ? data.goals : [];
      setGoals(saved);
      setStep(data.step ?? null);
      setSelectedGoalId(data.step?.goal_id ?? data.suggestedGoalId ?? saved[0]?.id ?? "");
    } catch {
      setMessage("Couldn't load your saved goals. Please refresh.");
    }
  }, []);

  // Extract goals from whichever input the user provided.
  async function rescanGoals() {
    if (!text.trim() && !image) {
      setMessage("Add some text or choose an image to scan. Either one is enough!");
      setExtractedGoals([]);
      setHasScanned(false);
      return;
    }

    setBusy(true);
    setExtractStatus(image ? "uploading" : "processing");
    setUploadProgress(null);
    setMessage("");

    try {
      const formData = new FormData();

      if (text.trim()) {
        formData.append("text", text.trim());
      }

      if (image) {
        formData.append("image", image);
      }

      const data = await new Promise<ExtractionResponse>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/goals/extract");
        request.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        });
        request.upload.addEventListener("load", () => {
          setExtractStatus("processing");
          setUploadProgress(null);
        });
        request.addEventListener("load", () => {
          let result: ExtractionResponse;
          try {
            result = JSON.parse(request.responseText) as ExtractionResponse;
          } catch {
            reject(new Error("The server returned an unreadable response."));
            return;
          }

          if (request.status < 200 || request.status >= 300) {
            reject(new Error(result.error || "Couldn't extract goals."));
            return;
          }

          resolve(result);
        });
        request.addEventListener("error", () => {
          reject(new Error("Couldn't reach the server. Please try again."));
        });
        request.send(formData);
      });

      const results = Array.isArray(data.goals) ? data.goals : [];

      setExtractedGoals(
        results.filter(
          (goal: unknown): goal is string =>
            typeof goal === "string" && goal.trim().length > 0
        )
      );
      setHasScanned(true);

      if (results.length === 0) {
        setMessage("No goals found. Try different text or another image.");
      } else {
        setMessage(`Found ${results.length} goal(s). Review them below.`);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while scanning."
      );
      setHasScanned(false);
    } finally {
      setBusy(false);
      setExtractStatus(null);
      setUploadProgress(null);
    }
  }

  // Save the reviewed goals in one request. The person chooses a weekly focus next.
  async function saveGoals() {
    const goalsToSave = extractedGoals.map((goal) => goal.trim()).filter(Boolean);

    if (!hasScanned || goalsToSave.length === 0) {
      setMessage("Scan your input first so there are goals to save.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: goalsToSave, source: image ? "image" : "manual" }),
      });
      const data = await response.json().catch(() => ({}));

      // Goals are saved even if the first step failed; show what we have.
      if (Array.isArray(data.goals)) {
        setGoals(data.goals);
        setSelectedGoalId(data.suggestedGoalId ?? data.goals[0]?.id ?? "");
      }
      setStep(data.step ?? null);

      if (!response.ok) throw new Error(data.error || "Couldn't save your goals.");

      setScreen(2);
      setMessage("Goals saved. Choose one to focus on this week.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't save your goals.");
    } finally {
      setBusy(false);
    }
  }

  async function planThisWeek() {
    if (!selectedGoalId) {
      setMessage("Choose a goal for this week's focus first.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: selectedGoalId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Couldn't plan this week's focus.");
      setStep(data.step ?? null);
      setMessage(data.created ? "Your focus is ready. Take it one small step at a time." : "Your current weekly focus is ready whenever you are.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't plan this week's focus.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStep(
    stepId: string,
    action: "done" | "too_big" | "skip"
  ) {
    setBusy(true);
    setMessage("");

    try {
      const body =
        action === "too_big"
          ? { shrink: true }
          : { status: action === "done" ? "done" : "skipped" };

      const response = await fetch(`/api/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Couldn't update this step.");
      }

      await reload();

      if (action === "done") {
        setMessage("Nice work. Your check-in is done for this week.");
      } else if (action === "too_big") {
        setMessage("No problem. Here's a gentler version of the same step.");
      } else {
        setMessage("Skipped for now. You can start fresh next week.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Couldn't update this step."
      );
    } finally {
      setBusy(false);
    }
  }

  function saveCheckInDay(day: CheckInDay) {
    setCheckInDay(day);
    const label = CHECK_IN_DAYS.find((option) => option.value === day)?.label ?? "selected day";
    setMessage(`Reminder day set to ${label}. Download the calendar event when you're ready.`);
  }

  function downloadCheckInReminder() {
    const calendar = createWeeklyCheckInCalendar(checkInDay, window.location.origin);
    const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "slothsteps-weekly-check-in.ics";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage("Calendar reminder downloaded. Add it to your calendar to get a weekly nudge.");
  }

  return (
    <main className="app-shell">
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="SlothSteps home">
          <span className="wordmark-mark" aria-hidden="true">S</span>
          <span>sloth<span className="wordmark-light">steps</span></span>
        </a>
        <p className="masthead-note">A gentler way to get moving</p>
      </header>

      <section className="intro" id="top">
        <p className="eyebrow">Make progress at your own pace</p>
        <h1>Make room for <em>one thing.</em></h1>
        <p className="intro-copy">
          You don&apos;t need the whole plan today. Find one thing that matters,
          then make the next step small enough to start.
        </p>
      </section>

      <nav className="step-nav" aria-label="Your workflow">
        <button type="button" onClick={() => setScreen(1)} aria-current={screen === 1 ? "step" : undefined} className={`step-tab ${screen === 1 ? "step-tab-active" : ""}`}>
          <span className="step-number">01</span><span>Your goals</span>
        </button>
        <button type="button" onClick={() => setScreen(2)} aria-current={screen === 2 ? "step" : undefined} className={`step-tab ${screen === 2 ? "step-tab-active" : ""}`}>
          <span className="step-number">02</span><span>This week&apos;s focus</span>
        </button>
      </nav>

      <div className="workspace-grid">
        <div className="workspace-main">
          {message && <p role="status" className="status-message">{message}</p>}

          {screen === 1 && (
            <section className="workflow-panel">
              <div className="panel-heading">
                <div><p className="eyebrow">Start where you are</p><h2>What&apos;s on your mind?</h2></div>
                <span className="panel-index">01 / 02</span>
              </div>
              <p className="panel-description">Add a few notes, choose an image, or use both. At least one is needed to find your goals.</p>

              <div className="field-group">
                <label htmlFor="goal-text" className="field-label">Goals or notes <span>TEXT</span></label>
                <textarea id="goal-text" value={text} disabled={busy} onChange={(event) => { setText(event.target.value); setHasScanned(false); }} placeholder={"Learn machine learning\nBuild a project\nPrepare for an exam"} rows={5} className="goal-textarea" />
              </div>

              <div className="field-group">
                <label htmlFor="goal-image" className="field-label">Vision board or image <span>IMAGE</span></label>
                <div className="upload-area">
                  <input id="goal-image" type="file" accept="image/*" disabled={busy} onChange={(event) => { setImage(event.target.files?.[0] ?? null); setHasScanned(false); }} className="upload-input" />
                  <label htmlFor="goal-image" className="upload-label">
                    <span className="upload-symbol" aria-hidden="true">+</span>
                    <span><strong>{image ? "Choose a different image" : "Choose an image"}</strong><small>PNG, JPG, or another image format</small></span>
                  </label>
                  {image && <div className="selected-file"><span className="file-indicator" aria-hidden="true" /><span className="file-name">{image.name}</span><button type="button" disabled={busy} onClick={() => { setImage(null); setHasScanned(false); }} className="text-action">Remove</button></div>}
                </div>
              </div>

              <button type="button" onClick={rescanGoals} disabled={busy} className="secondary-button scan-button">
                {extractStatus === "uploading"
                  ? "Uploading image…"
                  : extractStatus === "processing"
                    ? "Reading your input…"
                    : hasScanned
                      ? "Scan again"
                      : "Find my goals"}<span aria-hidden="true">→</span>
              </button>

              {extractStatus && (
                <div className="extraction-progress" role="status" aria-live="polite" aria-atomic="true" aria-busy="true">
                  <div className="extraction-status-row">
                    <span className="loading-indicator" aria-hidden="true" />
                    <span>
                      {extractStatus === "uploading"
                        ? uploadProgress === null
                          ? `Uploading ${image?.name ?? "image"}…`
                          : `Uploading image… ${uploadProgress}%`
                        : image
                          ? "Image received. Reading it for goals…"
                          : "Finding goals from your notes…"}
                    </span>
                  </div>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label={extractStatus === "uploading" ? "Image upload progress" : "Goal extraction progress"}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={extractStatus === "uploading" ? uploadProgress ?? undefined : undefined}
                    aria-valuetext={extractStatus === "processing" ? "Analyzing input" : undefined}
                  >
                    <span
                      className={`progress-fill ${uploadProgress === null ? "progress-indeterminate" : ""}`}
                      style={uploadProgress === null ? undefined : { width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {hasScanned && (
                <div className="results-panel">
                  <div className="results-heading"><div><p className="eyebrow">Your first draft</p><h3>Review your goals</h3></div><span className="result-count">{extractedGoals.filter((goal) => goal.trim()).length}</span></div>
                  {extractedGoals.length > 0 ? (
                    <ul className="goal-list">
                      {extractedGoals.map((goal, index) => (
                        <li key={index} className="goal-list-item">
                          <label className="sr-only" htmlFor={`extracted-goal-${index}`}>Goal {index + 1}</label>
                          <input id={`extracted-goal-${index}`} value={goal} onChange={(event) => setExtractedGoals((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="goal-edit-input" />
                          <button type="button" onClick={() => setExtractedGoals((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="remove-goal" aria-label={`Remove goal ${index + 1}`} title="Remove goal">×</button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="empty-results">No goals to show yet. Try changing your input and scanning again.</p>}
                  <button type="button" onClick={() => setExtractedGoals((current) => [...current, ""])} className="text-action add-goal">+ Add a goal</button>
                </div>
              )}

              <button type="button" onClick={saveGoals} disabled={busy || !hasScanned || !extractedGoals.some((goal) => goal.trim())} className="primary-button">
                {busy && !extractStatus ? "Saving your goals…" : "Save goals & continue"}<span aria-hidden="true">→</span>
              </button>
            </section>
          )}

          {screen === 2 && (
            <section className="step-panel">
              <div className="panel-heading"><div><p className="eyebrow">One thing at a time</p><h2>This week&apos;s focus</h2></div><span className="panel-index">02 / 02</span></div>
              <p className="panel-description">Choose one goal. SlothSteps will suggest one tiny action for the week. There&apos;s no penalty for taking your time.</p>
              {goals.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-mark" aria-hidden="true">＋</span>
                  <h3>Your next step starts with a goal.</h3>
                  <p>Add something you&apos;d like to work toward, big or small.</p>
                  <button type="button" onClick={() => setScreen(1)} className="secondary-button">Add your first goal <span aria-hidden="true">→</span></button>
                </div>
              ) : step ? (
                <div className="saved-goals">
                  <article className={`saved-goal ${step.status !== "pending" ? "saved-goal-settled" : ""}`}>
                    <div className="saved-goal-heading">
                      <span className="goal-sequence" aria-hidden="true">✦</span>
                      <h3>{step.goal_text}</h3>
                      {step.status !== "pending" && (
                        <span className={`goal-status goal-status-${step.status}`}>
                          {step.status === "done" ? "Done" : "Skipped"}
                        </span>
                      )}
                    </div>
                    <p className="next-step-label">Your tiny step</p>
                    <p className="next-step-text">{step.text}</p>
                    <p className="next-step-label">
                      About {step.minutes} {step.minutes === 1 ? "minute" : "minutes"}
                      {step.shrink_count > 0 ? ` · made smaller ${step.shrink_count}×` : ""}
                    </p>
                    {step.status === "pending" ? (
                      <div className="step-actions">
                        <button type="button" disabled={busy} onClick={() => updateStep(step.id, "done")} className="done-button"><span aria-hidden="true">✓</span> Done</button>
                        <button type="button" disabled={busy} onClick={() => updateStep(step.id, "too_big")} className="step-action-button">Too big</button>
                        <button type="button" disabled={busy} onClick={() => updateStep(step.id, "skip")} className="step-action-button quiet-action">Skip for now</button>
                      </div>
                    ) : (
                      <div className="check-in-complete">
                        <p>{step.status === "done" ? "You showed up for this goal. That counts." : "This goal can wait. You can choose a fresh focus next week."}</p>
                      </div>
                    )}
                  </article>
                  {goals.length > 1 && (
                    <details className="all-goals">
                      <summary>Your other goals ({goals.filter((goal) => goal.id !== step.goal_id).length})</summary>
                      <ul>{goals.filter((goal) => goal.id !== step.goal_id).map((goal) => <li key={goal.id}>{goal.text}</li>)}</ul>
                    </details>
                  )}
                </div>
              ) : (
                <div className="focus-picker">
                  <label htmlFor="weekly-focus" className="field-label">Which goal feels right this week?</label>
                  <select
                    id="weekly-focus"
                    value={selectedGoalId}
                    disabled={busy}
                    onChange={(event) => setSelectedGoalId(event.target.value)}
                    className="focus-select"
                  >
                    {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.text}</option>)}
                  </select>
                  <p className="focus-hint">You can choose a different one next week. Nothing else needs your attention today.</p>
                  <button type="button" onClick={planThisWeek} disabled={busy || !selectedGoalId} className="primary-button">
                    {busy ? "Finding one small step…" : "Plan this week's tiny step"}<span aria-hidden="true">→</span>
                  </button>
                </div>
              )}

              {goals.length > 0 && (
                <section className="reminder-panel" aria-labelledby="reminder-heading">
                  <div className="reminder-heading">
                    <span className="reminder-mark" aria-hidden="true">↻</span>
                    <div>
                      <p className="eyebrow">A gentle nudge</p>
                      <h3 id="reminder-heading">Make space for a weekly check-in</h3>
                      <p>Pick a day that feels easy to come back to. No pressure if plans change.</p>
                    </div>
                  </div>
                  <div className="reminder-controls">
                    <div className="reminder-day-field">
                      <label htmlFor="check-in-day">Your check-in day</label>
                      <select id="check-in-day" value={checkInDay} onChange={(event) => saveCheckInDay(event.target.value as CheckInDay)} className="focus-select">
                        {CHECK_IN_DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                      </select>
                      <span className="reminder-time">9:00 a.m. · your local time</span>
                    </div>
                    <button type="button" onClick={downloadCheckInReminder} className="secondary-button">Add to my calendar<span aria-hidden="true">→</span></button>
                  </div>
                  <p className="reminder-note">We&apos;ll download a calendar event for you to add. It only says “SlothSteps weekly check-in” — never your goals or step.</p>
                </section>
              )}
              <button type="button" onClick={() => setScreen(1)} className="back-link"><span aria-hidden="true">←</span> Back to your goals</button>
            </section>
          )}
        </div>

        <aside className="side-note">
          <p className="eyebrow">A note for today</p>
          <div className="side-note-rule" />
          <p className="side-note-quote">You&apos;re allowed to begin before you feel ready.</p>
          <p className="side-note-copy">A small, kind step still counts as progress. Especially on the days when everything feels like a lot.</p>
          <div className="side-note-footer"><span className="saved-count">{goals.length}</span><span>{goals.length === 1 ? "goal saved" : "goals saved"}</span></div>
        </aside>
      </div>
      <footer className="page-footer"><span>SlothSteps</span><span>Small is a strategy.</span></footer>
    </main>
  );
}
