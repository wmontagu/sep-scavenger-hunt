import { useEffect, useRef, useState } from "react";
import type { PublicStage, VerifyResult } from "@/lib/board";
import { downscaleImage, local, postJson } from "./client-utils";

interface Props {
  stage: PublicStage;
  thread?: "local" | "global";
  shareMessage: string;
  advisorBlurb: string;
  /** Called after any successful submit so the page can refetch state immediately. */
  onSolved: () => void;
}

const shareKey = (id: string) => `hunt:share:${id}`;
const reviewKeyFor = (id: string) => `hunt:review:${id}`;

export function StageCard({ stage, thread, shareMessage, advisorBlurb, onSolved }: Props) {
  const [share, setShare] = useState<string | null>(null);
  const [inlineClue, setInlineClue] = useState<string | null>(null);

  // Shares survive refreshes on the device that earned them.
  useEffect(() => {
    setShare(local.get(shareKey(stage.id)));
  }, [stage.id]);

  const handleResult = (r: VerifyResult) => {
    if (r.share) {
      local.set(shareKey(stage.id), r.share);
      setShare(r.share);
    }
    if (r.next_clue) setInlineClue(r.next_clue);
    onSolved();
  };

  return (
    <section className={`card ${thread ?? ""} ${stage.solved ? "solved" : ""}`} id={stage.id}>
      <h2>
        <span>{stage.title}</span>
        {stage.solved ? <span className="badge good">Solved</span> : <span className="badge">Open</span>}
      </h2>
      {stage.subtitle && <div className="subtitle">{stage.subtitle}</div>}
      {stage.clue && <div className="clue">{stage.clue}</div>}
      {stage.prompt && stage.input === "text" && !stage.solved && <p className="muted">{stage.prompt}</p>}

      {stage.documents && !stage.solved && (
        <div className="docs">
          {stage.documents.map((d) => (
            <a key={d.src} href={d.src} target="_blank" rel="noreferrer" title="Open full size">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.src} alt={d.alt} loading="lazy" />
            </a>
          ))}
          <div className="overlay-caption">Tap a document to open it full size.</div>
        </div>
      )}

      {stage.overlay && !stage.solved && (
        <div className="overlay-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stage.overlay} alt="Outline of the sign with circled letter positions. Line it up with what you find" />
          {stage.overlay_caption && <div className="overlay-caption">{stage.overlay_caption}</div>}
        </div>
      )}

      {stage.available && stage.input === "text" && <TextAnswer stageId={stage.id} onResult={handleResult} />}
      {stage.available && stage.input === "image" && (
        <PhotoAnswer stageId={stage.id} label={stage.prompt} onResult={handleResult} onShare={(s) => {
          local.set(shareKey(stage.id), s);
          setShare(s);
          onSolved();
        }} />
      )}

      {stage.reveal && <p className="feedback good">{stage.reveal}</p>}
      {inlineClue && stage.solved && (stage.id === "7a_wqed" || stage.id === "4_fence") && (
        <p className="feedback good">Unlocked! The next clue is just below. ↓</p>
      )}

      {share && (
        <div className="share">
          <div className="muted small">Your half of the code</div>
          <div className="code">{share}</div>
          <p>{shareMessage}</p>
        </div>
      )}

      {stage.advisor && !stage.solved && <AdvisorButton stageId={stage.id} blurb={advisorBlurb} />}
    </section>
  );
}

function TextAnswer({ stageId, onResult }: { stageId: string; onResult: (r: VerifyResult) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "good" | "bad"; text: string } | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const { status, data } = await postJson<VerifyResult & { error?: string }>("/api/verify", {
        stage: stageId,
        submission: value,
      });
      if (status === 429) setMsg({ kind: "bad", text: "Too many guesses. Wait a minute." });
      else if (data.success) {
        setMsg({ kind: "good", text: data.already_solved ? "Already solved by your team." : "Correct." });
        setValue("");
        onResult(data);
      } else {
        setMsg({ kind: "bad", text: "Not quite." });
        setShake(true);
        // select the wrong guess so the next keystroke replaces it
        requestAnimationFrame(() => inputRef.current?.select());
      }
    } catch {
      setMsg({ kind: "bad", text: "Network hiccup, try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className={`answer ${shake ? "shake" : ""}`} onAnimationEnd={() => setShake(false)} onSubmit={submit}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Answer"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Answer"
          maxLength={200}
        />
        <button type="submit" disabled={busy || !value.trim()}>
          {busy ? "…" : "Submit"}
        </button>
      </form>
      <div className={`feedback ${msg?.kind ?? ""}`} role="status">
        {msg?.text}
      </div>
    </>
  );
}

function PhotoAnswer({
  stageId,
  label,
  onResult,
  onShare,
}: {
  stageId: string;
  label?: string;
  onResult: (r: VerifyResult) => void;
  onShare: (share: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "good" | "bad" | "pending"; text: string } | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cb = useRef({ onResult, onShare });
  cb.current = { onResult, onShare };

  useEffect(() => {
    const saved = local.get(reviewKeyFor(stageId));
    if (saved) {
      setReviewId(saved);
      setMsg({ kind: "pending", text: "Your photo is with an exec for approval…" });
    }
  }, [stageId]);

  // Poll the manual-review queue for this device's photo.
  useEffect(() => {
    if (!reviewId) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/review-status?id=${encodeURIComponent(reviewId)}`, { cache: "no-store" });
        const data = (await res.json()) as { status: string; share?: string };
        if (stop) return;
        if (data.status === "approved") {
          local.set(reviewKeyFor(stageId), null);
          setReviewId(null);
          setMsg({ kind: "good", text: "Approved!" });
          if (data.share) cb.current.onShare(data.share);
          else cb.current.onResult({ success: true, already_solved: true });
        } else if (data.status === "rejected" || data.status === "unknown") {
          local.set(reviewKeyFor(stageId), null);
          setReviewId(null);
          setMsg({
            kind: "bad",
            text:
              data.status === "rejected"
                ? "That one didn't pass review. Try another photo."
                : "That photo is no longer in the review queue. Please submit again.",
          });
        }
      } catch {
        /* keep polling */
      }
    };
    const t = setInterval(tick, 4000);
    void tick();
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [reviewId, stageId]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsg(null);
    try {
      setPreview(await downscaleImage(file));
    } catch (err) {
      setMsg({ kind: "bad", text: (err as Error).message });
    }
  }

  async function submit() {
    if (!preview || busy) return;
    setBusy(true);
    setMsg({ kind: "pending", text: "Checking your photo…" });
    try {
      const { status, data } = await postJson<VerifyResult>("/api/verify", { stage: stageId, submission: preview });
      if (status === 429) setMsg({ kind: "bad", text: "Too many uploads. Wait a minute." });
      else if (status !== 200) setMsg({ kind: "bad", text: "Couldn't upload that image. Try again." });
      else if (data.success) {
        setMsg({ kind: "good", text: data.already_solved ? "Already solved by your team." : "Approved!" });
        setPreview(null);
        onResult(data);
      } else if (data.pending_review && data.review_id) {
        local.set(reviewKeyFor(stageId), data.review_id);
        setReviewId(data.review_id);
        setPreview(null);
        setMsg({ kind: "pending", text: "Your photo is with an exec for approval. Keep this page open…" });
      } else {
        setMsg({ kind: "bad", text: "That doesn't look right. Try another photo." });
      }
    } catch {
      setMsg({ kind: "bad", text: "Network hiccup, try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload">
      {!reviewId && (
        <>
          <label className="pick">
            📷 {preview ? "Retake photo" : label ?? "Take a photo"}
            <input ref={inputRef} type="file" accept="image/*" capture="user" onChange={pick} />
          </label>
          {preview && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="preview" src={preview} alt="Your photo" />
              <button onClick={submit} disabled={busy}>
                {busy ? "Uploading…" : "Submit photo"}
              </button>
            </>
          )}
        </>
      )}
      {msg && <div className={`feedback ${msg.kind === "pending" ? "pending" : msg.kind}`}>{msg.text}</div>}
    </div>
  );
}

function AdvisorButton({ stageId, blurb }: { stageId: string; blurb: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function ask() {
    setState("sending");
    try {
      const { status } = await postJson("/api/advisor-request", { stage: stageId });
      setState(status === 200 ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="advisor">
      {state === "sent" ? (
        <span>🙋 An advisor has been pinged and is on the way.</span>
      ) : (
        <>
          <button className="ghost" onClick={ask} disabled={state === "sending"}>
            Ask an advisor
          </button>
          <span>{state === "error" ? "Couldn't reach the execs. Try again." : blurb}</span>
        </>
      )}
    </div>
  );
}
