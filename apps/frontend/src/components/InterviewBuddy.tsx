import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

interface Session {
  id: number;
  role_title: string;
  level: string;
  mode: string;
  status: string;
  total_questions: number;
  answered_count: number;
  avg_score: number | null;
  started_at: string;
}

interface Question {
  id: number;
  category: string;
  question_text: string;
  expected_focus: string;
  difficulty: number;
  response?: {
    transcript_text: string;
    ai_feedback: string;
    overall_score: number;
    scores_json: Record<string, number>;
  } | null;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token") ?? "";
  const tenantId = localStorage.getItem("tenant_id") ?? "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
  };
}

export default function InterviewBuddy() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [roleTitle, setRoleTitle] = useState("");
  const [level, setLevel] = useState("mid");
  const [mode, setMode] = useState("mock");
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await fetch(`${API}/interview/history`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const body = await response.json();
        setSessions(body.data ?? []);
      }
    } catch {
      setError("Failed to load history");
    }
  };

  const startSession = async () => {
    if (!roleTitle) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API}/interview/sessions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ role_title: roleTitle, level, mode }),
      });
      if (!response.ok) throw new Error(`Start failed (${response.status})`);
      const body = await response.json();
      setActiveSession(body.data);
      setQuestions(body.data.questions ?? []);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed");
    } finally {
      setBusy(false);
    }
  };

  const submitResponse = async (questionId: number) => {
    if (!transcript) return;
    setBusy(true);
    try {
      const response = await fetch(
        `${API}/interview/questions/${questionId}/respond`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ transcript_text: transcript }),
        }
      );
      if (!response.ok) throw new Error(`Submit failed (${response.status})`);
      const body = await response.json();
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, response: body.data } : q
        )
      );
      setTranscript("");
      if (activeSession) {
        setActiveSession({
          ...activeSession,
          answered_count: body.session_progress.answered,
          avg_score: body.session_progress.avg_score,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    setBusy(true);
    try {
      await fetch(`${API}/interview/sessions/${activeSession.id}/end`, {
        method: "POST",
        headers: authHeaders(),
      });
      setActiveSession(null);
      setQuestions([]);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "End failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="interview-buddy">
      <h2>Interview Buddy / Mock Interview</h2>
      {error && <p className="error">{error}</p>}

      {!activeSession && (
        <div className="start-form">
          <input
            placeholder="Role title (e.g. Product Manager)"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
          />
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="entry">Entry</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead</option>
          </select>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="mock">Mock Interview</option>
            <option value="buddy">Interview Buddy</option>
          </select>
          <button onClick={startSession} disabled={busy || !roleTitle}>
            {busy ? "Starting..." : "Start Session"}
          </button>
        </div>
      )}

      {activeSession && (
        <div className="active-session">
          <div className="session-header">
            <h3>
              {activeSession.role_title} · {activeSession.level} ·{" "}
              {activeSession.mode}
            </h3>
            <p>
              Progress: {activeSession.answered_count} /{" "}
              {activeSession.total_questions} · Avg Score:{" "}
              {activeSession.avg_score ?? "—"}
            </p>
            <button onClick={endSession} disabled={busy}>
              End Session
            </button>
          </div>

          <div className="questions">
            {questions.map((q) => (
              <div key={q.id} className="question-card">
                <div className="question-meta">
                  <span className="badge">{q.category}</span>
                  <span>Difficulty {q.difficulty}/5</span>
                </div>
                <p className="question-text">{q.question_text}</p>

                {!q.response && (
                  <div className="response-form">
                    <textarea
                      rows={4}
                      placeholder="Type your answer..."
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                    />
                    <button
                      onClick={() => submitResponse(q.id)}
                      disabled={busy || !transcript}
                    >
                      {busy ? "Submitting..." : "Submit Answer"}
                    </button>
                  </div>
                )}

                {q.response && (
                  <div className="feedback">
                    <div className="score-bar">
                      <span>Overall: {q.response.overall_score}/100</span>
                      <div
                        className="bar"
                        style={{
                          width: `${q.response.overall_score}%`,
                          background:
                            q.response.overall_score >= 80
                              ? "#22c55e"
                              : q.response.overall_score >= 60
                              ? "#f59e0b"
                              : "#ef4444",
                        }}
                      />
                    </div>
                    <p className="feedback-text">{q.response.ai_feedback}</p>
                    <div className="rubric">
                      {Object.entries(q.response.scores_json).map(
                        ([key, score]) => (
                          <div key={key} className="rubric-item">
                            <span>{key}</span>
                            <strong>{score}</strong>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="history">
        <h3>History</h3>
        {sessions.length === 0 && <p>No sessions yet.</p>}
        {sessions.map((s) => (
          <div key={s.id} className="history-row">
            <span>
              {s.role_title} · {s.level}
            </span>
            <span>
              {s.answered_count}/{s.total_questions} · Score:{" "}
              {s.avg_score ?? "—"}
            </span>
            <span className={`status ${s.status}`}>{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
