import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import type { AdvisorPing, Board, Review } from "@/lib/board";
import type { Answers, ContentProblem, StageId } from "@/lib/stage-config";
import { local, postJson } from "@/components/client-utils";

/**
 * Exec console - not linked from the pledge board. Everything here is behind
 * EXEC_PASSCODE; this page itself holds no secrets.
 */

interface ExecState {
  board: Board;
  reviews: Review[];
  advisor: AdvisorPing[];
  answers: Answers;
  content_problems: ContentProblem[];
  image_verifier: string;
  ai_calls: { used: number; cap: number };
  storage: string;
  webhook: boolean;
}

const STAGES: StageId[] = [
  "1_cap_table",
  "2_term_sheet",
  "3_pitch_deck",
  "4_fence",
  "6_gates",
  "7a_wqed",
  "7b_cathedral",
  "8_convergence",
];

const ago = (iso?: string) => {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
};

export default function Exec() {
  const [pass, setPass] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<ExecState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resetText, setResetText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (p: string) => {
    try {
      const res = await fetch("/api/exec/state", { headers: { "x-exec-passcode": p }, cache: "no-store" });
      if (res.status === 404) {
        setAuthed(false);
        setErr("Wrong passcode (or EXEC_PASSCODE isn't set on the server).");
        local.set("hunt:exec-pass", null);
        return;
      }
      setData((await res.json()) as ExecState);
      setAuthed(true);
      setErr(null);
    } catch {
      setErr("Can't reach server.");
    }
  }, []);

  useEffect(() => {
    const saved = local.get("hunt:exec-pass");
    if (saved) {
      setPass(saved);
      void load(saved);
    }
  }, [load]);

  useEffect(() => {
    if (!authed) return;
    const t = setInterval(() => load(pass), 4000);
    return () => clearInterval(t);
  }, [authed, pass, load]);

  async function act(body: object) {
    setBusy(true);
    try {
      const { status, data: d } = await postJson<{ error?: string }>("/api/exec/action", body, {
        "x-exec-passcode": pass,
      });
      if (status !== 200) setErr(d.error ?? `HTTP ${status}`);
      await load(pass);
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <main className="wrap">
        <Head>
          <title>Exec console</title>
        </Head>
        <h1>Exec console</h1>
        <form
          className="answer"
          onSubmit={(e) => {
            e.preventDefault();
            local.set("hunt:exec-pass", pass);
            void load(pass);
          }}
        >
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Exec passcode" />
          <button type="submit">Enter</button>
        </form>
        {err && <p className="feedback bad">{err}</p>}
      </main>
    );
  }

  if (!data) return null;
  const { board } = data;
  // mirrors outdoorOpen() in lib/board.ts (not imported: that module is server-only)
  const indoorDone = (["1_cap_table", "2_term_sheet", "3_pitch_deck"] as const).every((id) => board.stages[id].solved);
  const pending = data.reviews.filter((r) => r.status === "pending");
  const decided = data.reviews.filter((r) => r.status !== "pending");

  return (
    <main className="wrap">
      <Head>
        <title>Exec console</title>
      </Head>
      <header className="masthead">
        <h1>Exec console</h1>
        <button
          className="ghost"
          onClick={() => {
            local.set("hunt:exec-pass", null);
            setAuthed(false);
            setData(null);
          }}
        >
          Lock
        </button>
      </header>
      {err && <p className="feedback bad">{err}</p>}

      <div className="section-label">Status</div>
      <section className="card">
        <dl className="kv">
          <dt>storage</dt>
          <dd>{data.storage === "redis" ? "redis ✓" : "file (⚠ lost on redeploy, add Redis for the event)"}</dd>
          <dt>photo check</dt>
          <dd>
            {data.image_verifier}
            {data.image_verifier === "manual"
              ? " (every photo comes here)"
              : ` · AI calls ${data.ai_calls.used}/${data.ai_calls.cap}`}
          </dd>
          <dt>webhook</dt>
          <dd>{data.webhook ? "on" : "off (watch this page for pings)"}</dd>
          <dt>outdoor</dt>
          <dd>{indoorDone ? "OPEN (indoor round solved)" : board.outdoor_open ? "OPEN (forced by exec)" : "closed (opens when stages 1-3 are solved)"}</dd>
          <dt>ransom note</dt>
          <dd>{board.ransom_note_visible ? "visible" : "hidden"}</dd>
          <dt>complete</dt>
          <dd>{board.complete ? "YES" : "no"}</dd>
          <dt>local share</dt>
          <dd>{board.local_share ?? "-"} <span className="muted">(answer key: {data.answers.shares.local})</span></dd>
          <dt>global share</dt>
          <dd>{board.global_share ?? "-"} <span className="muted">(answer key: {data.answers.shares.global})</span></dd>
        </dl>
        {data.content_problems.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {data.content_problems.map((p, i) => (
              <div key={i} className={`problem ${p.level}`}>
                {p.level === "error" ? "✗" : "…"} {p.message}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="section-label">Controls</div>
      <section className="card">
        <div className="row">
          {indoorDone ? null : board.outdoor_open ? (
            <button className="ghost" disabled={busy} onClick={() => act({ action: "close_outdoor" })}>
              Close outdoor board
            </button>
          ) : (
            <button disabled={busy} onClick={() => act({ action: "open_outdoor" })}>
              Force-open outdoor board early
            </button>
          )}
          {board.complete ? (
            <button className="ghost" disabled={busy} onClick={() => act({ action: "complete", value: false })}>
              Un-complete
            </button>
          ) : (
            <button className="good" disabled={busy} onClick={() => act({ action: "complete", value: true })}>
              Mark hunt complete (61C)
            </button>
          )}
        </div>
      </section>

      <div className="section-label">Photo review ({pending.length} pending)</div>
      {pending.length === 0 && <p className="muted small">Nothing waiting.</p>}
      {pending.map((r) => (
        <section className="card review" key={r.id}>
          <div className="row">
            <strong>{r.stage}</strong>
            <span className="muted small">{ago(r.created_at)}</span>
          </div>
          {r.note && <div className="muted small">{r.note}</div>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.image} alt="submitted photo" />
          <div className="row">
            <button className="good" disabled={busy} onClick={() => act({ action: "review", id: r.id, approve: true })}>
              Approve
            </button>
            <button className="danger" disabled={busy} onClick={() => act({ action: "review", id: r.id, approve: false })}>
              Reject
            </button>
          </div>
        </section>
      ))}

      <div className="section-label">Photo log ({decided.length})</div>
      <p className="muted small">
        Every photo after a decision, newest first, including ones the AI approved on its own. If an approved one is
        fake, revoke it: that un-solves the Cathedral, so the final stage locks again until a real photo goes through.
      </p>
      {decided.length === 0 && <p className="muted small">No photos yet.</p>}
      {decided.map((r) => (
        <PhotoLogItem
          key={r.id}
          review={r}
          pass={pass}
          busy={busy}
          canRevoke={r.status === "approved" && board.stages[r.stage].solved}
          onRevoke={() => act({ action: "set_stage", stage: r.stage, solved: false })}
        />
      ))}

      <div className="section-label">Advisor pings</div>
      {data.advisor.length === 0 && <p className="muted small">None yet.</p>}
      {data.advisor.map((p, i) => (
        <div key={i} className="card small">
          <strong>{p.stage}</strong> <span className="muted">{ago(p.at)}</span>
          {p.message && <div>{p.message}</div>}
        </div>
      ))}

      <div className="section-label">Stages (manual override)</div>
      <section className="card">
        {STAGES.map((id) => (
          <div className="row" key={id} style={{ justifyContent: "space-between", padding: "6px 0" }}>
            <span>
              {board.stages[id].solved ? "✅" : "⬜️"} {id}{" "}
              <span className="muted small">{ago(board.stages[id].solved_at)}</span>
            </span>
            <button
              className="ghost"
              disabled={busy}
              onClick={() => act({ action: "set_stage", stage: id, solved: !board.stages[id].solved })}
            >
              {board.stages[id].solved ? "Unsolve" : "Force solve"}
            </button>
          </div>
        ))}
      </section>

      <div className="section-label">Answer key</div>
      <section className="card">
        <pre className="small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {JSON.stringify(data.answers, (k, v) => (k.startsWith("_") ? undefined : v), 2)}
        </pre>
      </section>

      <div className="section-label">Danger zone</div>
      <section className="card">
        <p className="small muted">Reset wipes all progress, photo reviews and advisor pings. Type RESET to enable.</p>
        <form
          className="answer"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: "reset", confirm: resetText });
            setResetText("");
          }}
        >
          <input type="text" value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="RESET" />
          <button className="danger" type="submit" disabled={busy || resetText !== "RESET"}>
            Reset hunt
          </button>
        </form>
      </section>
    </main>
  );
}

function PhotoLogItem({
  review,
  pass,
  busy,
  canRevoke,
  onRevoke,
}: {
  review: Review;
  pass: string;
  busy: boolean;
  canRevoke: boolean;
  onRevoke: () => void;
}) {
  // Images aren't in the polled state (too heavy); fetch one when asked.
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function show() {
    setLoading(true);
    try {
      const res = await fetch(`/api/exec/photo?id=${encodeURIComponent(review.id)}`, {
        headers: { "x-exec-passcode": pass },
        cache: "no-store",
      });
      if (res.ok) setImage(((await res.json()) as { image: string }).image);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card review">
      <div className="row">
        <strong>
          {review.stage} · {review.status === "approved" ? "✓ approved" : "✗ rejected"}
        </strong>
        <span className="muted small">{ago(review.decided_at ?? review.created_at)}</span>
      </div>
      {review.note && <div className="muted small">{review.note}</div>}
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="submitted photo" />
      ) : (
        <button className="ghost" disabled={loading} onClick={show}>
          {loading ? "Loading…" : "Show photo"}
        </button>
      )}
      {canRevoke && (
        <div className="row">
          <button className="danger" disabled={busy} onClick={onRevoke}>
            Revoke (looks fake)
          </button>
        </div>
      )}
    </section>
  );
}
