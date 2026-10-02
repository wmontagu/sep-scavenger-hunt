import Head from "next/head";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicStage, PublicState } from "@/lib/board";
import { StageCard } from "@/components/StageCard";
import { local, syncEpoch } from "@/components/client-utils";

const POLL_MS = 2000;
const TOAST_MS = 6000;

type Thread = "local" | "global";
interface Toast {
  key: number;
  text: string;
  kind?: Thread;
}

function solvedStages(s: PublicState): Map<string, { stage: PublicStage; thread?: Thread }> {
  const m = new Map<string, { stage: PublicStage; thread?: Thread }>();
  for (const st of s.indoor) if (st.solved) m.set(st.id, { stage: st });
  for (const st of s.local) if (st.solved) m.set(st.id, { stage: st, thread: "local" });
  for (const st of s.global) if (st.solved) m.set(st.id, { stage: st, thread: "global" });
  if (s.convergence?.solved) m.set(s.convergence.id, { stage: s.convergence });
  return m;
}

/** What changed between two polls, as banner lines everyone should hear about. */
function announcements(prev: PublicState, next: PublicState): Omit<Toast, "key">[] {
  const out: Omit<Toast, "key">[] = [];
  const before = solvedStages(prev);
  for (const [id, { stage, thread }] of solvedStages(next)) {
    if (before.has(id)) continue;
    const who = thread === "local" ? "Local thread" : thread === "global" ? "Global thread" : "Someone";
    out.push({ text: `✓ ${who} solved “${stage.title}”`, kind: thread });
  }
  if (!prev.outdoor_open && next.outdoor_open) out.push({ text: "🔓 Indoor round done — the outdoor board is open!" });
  if (!prev.ransom_note && next.ransom_note) out.push({ text: "📨 Something was intercepted — check the top of the board." });
  if (!prev.complete && next.complete) out.push({ text: "🎉 Hunt complete!" });
  return out;
}

export default function Board() {
  const [state, setState] = useState<PublicState | null>(null);
  const [stale, setStale] = useState(false);
  const [thread, setThread] = useState<Thread | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const inflight = useRef(false);
  const prevState = useRef<PublicState | null>(null);
  const toastSeq = useRef(0);

  const pushToasts = useCallback((items: Omit<Toast, "key">[]) => {
    if (!items.length) return;
    const withKeys = items.map((t) => ({ ...t, key: ++toastSeq.current }));
    setToasts((cur) => [...cur, ...withKeys].slice(-4));
    navigator.vibrate?.(120);
    for (const t of withKeys) {
      setTimeout(() => setToasts((cur) => cur.filter((x) => x.key !== t.key)), TOAST_MS);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as PublicState;
      // Board was reset since this phone last looked: drop stale shares, then remount.
      if (syncEpoch(next.epoch)) {
        window.location.reload();
        return;
      }
      if (prevState.current && prevState.current.epoch === next.epoch) {
        pushToasts(announcements(prevState.current, next));
      }
      prevState.current = next;
      setState(next);
      setStale(false);
    } catch {
      setStale(true);
    } finally {
      inflight.current = false;
    }
  }, [pushToasts]);

  useEffect(() => {
    const saved = local.get("hunt:thread");
    if (saved === "local" || saved === "global") setThread(saved);
    void refresh();
    const t = setInterval(refresh, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const pickThread = (t: Thread | null) => {
    setThread(t);
    local.set("hunt:thread", t);
    window.scrollTo({ top: 0 });
  };

  if (!state) {
    return (
      <main className="wrap">
        <Head>
          <title>SEP Pledge Hunt</title>
        </Head>
        <p className="muted">{stale ? "Can't reach the board — retrying…" : "Loading the board…"}</p>
      </main>
    );
  }

  const allStages = [...state.indoor, ...state.local, ...state.global, ...(state.convergence ? [state.convergence] : [])];
  const totalStages = 7;
  const solvedCount = allStages.filter((s) => s.solved).length;
  const common = {
    shareMessage: state.share_message,
    advisorBlurb: state.advisor_blurb,
    onSolved: refresh,
  };

  const threadDone = (stages: PublicStage[], full: number) => stages.length >= full && stages.every((x) => x.solved);
  const threads = {
    local: { stages: state.local, done: threadDone(state.local, 2) },
    global: { stages: state.global, done: threadDone(state.global, 2) },
  };

  return (
    <main className="wrap">
      <Head>
        <title>{state.title}</title>
      </Head>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.key} className={`toast ${t.kind ?? ""}`}>
            {t.text}
          </div>
        ))}
      </div>

      <header className="masthead">
        <h1>{state.title}</h1>
        <span className={`live ${stale ? "stale" : ""}`}>{stale ? "reconnecting" : "live"}</span>
      </header>
      <div className="progress" aria-label={`${solvedCount} of ${totalStages} stages solved`}>
        {Array.from({ length: totalStages }, (_, i) => (
          <span key={i} className={i < solvedCount ? "on" : ""} />
        ))}
      </div>
      <p className="tagline">{state.tagline}</p>

      {state.complete && (
        <section className="complete">
          <div className="big">🎉</div>
          <h2>{state.complete_message}</h2>
        </section>
      )}

      {state.ransom_note && (
        <section className="ransom" aria-live="polite">
          <h2>Intercepted</h2>
          <p>{state.ransom_note}</p>
        </section>
      )}

      {state.convergence && <StageCard stage={state.convergence} {...common} />}

      {!state.outdoor_open ? (
        // Screen 1: the indoor round, until all three are solved.
        <>
          <div className="section-label">Indoor board</div>
          {state.indoor.map((s) => (
            <StageCard key={s.id} stage={s} {...common} />
          ))}
          <div className="locked">{state.outdoor_locked_message}</div>
        </>
      ) : !thread ? (
        // Screen 2: pick a strategy.
        <section className="picker">
          <h2>{state.split_announcement}</h2>
          {(["local", "global"] as const).map((t) => {
            const label = state.threads[t];
            return (
              <button key={t} className={`pick-thread ${t}`} onClick={() => pickThread(t)}>
                <strong>{label.title}</strong>
                <small>{threads[t].done ? "✓ done" : label.subtitle}</small>
              </button>
            );
          })}
        </section>
      ) : (
        // Screen 3: only the chosen strategy's stages.
        <>
          <div className={`thread-bar ${thread}`}>
            <span>
              {state.threads[thread].title}
              {threads[thread].done && " · ✓ done"}
            </span>
            <button className="ghost" onClick={() => pickThread(null)}>
              Switch strategy
            </button>
          </div>
          {threads[thread].stages.map((s) => (
            <StageCard key={s.id} stage={s} thread={thread} {...common} />
          ))}
        </>
      )}
    </main>
  );
}
