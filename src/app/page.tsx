"use client";

import { useCallback, useEffect, useState } from "react";

type Goal = {
  goal_id: string;
  goal_text: string;
  step_id: string | null;
  step_text: string | null;
  status: "pending" | "done" | "skipped" | null;
};

type ExtractionResponse = {
  goals?: unknown;
  error?: string;
};

export default function Home() {
  // Keep every hook at the top level of the component.
  const [goals, setGoals] = useState<Goal[]>([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [extractedGoals, setExtractedGoals] = useState<string[]>([]);
  const [screen, setScreen] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [extractStatus, setExtractStatus] = useState<"uploading" | "processing" | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [hasScanned, setHasScanned] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadGoals() {
      try {
        const response = await fetch("/api/goals");
        if (!response.ok) throw new Error("Could not load goals");

        const data = await response.json();
        if (!cancelled) setGoals(Array.isArray(data.goals) ? data.goals : []);
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
      setGoals(Array.isArray(data.goals) ? data.goals : []);
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

  // Save each extracted goal using the existing goals API.
  async function saveGoals() {
    const goalsToSave = extractedGoals
      .map((goal) => goal.trim())
      .filter(Boolean);

    if (!hasScanned || goalsToSave.length === 0) {
      setMessage("Scan your input first so there are goals to save.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      for (const title of goalsToSave) {
        const response = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: title,
            source: image ? "image" : "manual",
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Couldn't save: ${title}`);
        }
      }

      await reload();
      setScreen(2);
      setMessage("Goals saved. Let's take one small step.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Couldn't save your goals."
      );
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
        setMessage("Nice! One small step completed.");
      } else if (action === "too_big") {
        setMessage("Let's make that step smaller.");
      } else {
        setMessage("Skipped for now. No pressure.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Couldn't update this step."
      );
    } finally {
      setBusy(false);
    }
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
          <span className="step-number">02</span><span>One small step</span>
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
              <div className="panel-heading"><div><p className="eyebrow">No rush, no perfect plan</p><h2>Just one small step</h2></div><span className="panel-index">02 / 02</span></div>
              <p className="panel-description">Pick what feels manageable. You can always make it smaller.</p>
              {goals.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-mark" aria-hidden="true">＋</span>
                  <h3>Your next step starts with a goal.</h3>
                  <p>Add something you&apos;d like to work toward, big or small.</p>
                  <button type="button" onClick={() => setScreen(1)} className="secondary-button">Add your first goal <span aria-hidden="true">→</span></button>
                </div>
              ) : (
                <div className="saved-goals">
                  {goals.map((goal, index) => (
                    <article key={goal.goal_id} className={`saved-goal ${goal.status === "done" || goal.status === "skipped" ? "saved-goal-settled" : ""}`}>
                      <div className="saved-goal-heading">
                        <span className="goal-sequence">{String(index + 1).padStart(2, "0")}</span>
                        <h3>{goal.goal_text}</h3>
                        {goal.status && goal.status !== "pending" && <span className={`goal-status goal-status-${goal.status}`}>{goal.status === "done" ? "Done" : "Later"}</span>}
                      </div>
                      <p className="next-step-label">A possible next step</p>
                      <p className="next-step-text">{goal.step_text || "Choose one small action to get started."}</p>
                      {goal.status === "pending" && (
                        <div className="step-actions">
                          <button type="button" disabled={busy || !goal.step_id} onClick={() => goal.step_id && updateStep(goal.step_id, "done")} className="done-button"><span aria-hidden="true">✓</span> Done</button>
                          <button type="button" disabled={busy || !goal.step_id} onClick={() => goal.step_id && updateStep(goal.step_id, "too_big")} className="step-action-button">Make it smaller</button>
                          <button type="button" disabled={busy || !goal.step_id} onClick={() => goal.step_id && updateStep(goal.step_id, "skip")} className="step-action-button quiet-action">Later</button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
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
