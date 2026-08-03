import { useEffect, useState } from "react";
import { aiController } from "../controllers/AIController";
import type { InterviewSession, InterviewQuestion } from "../services/AIService";

// Web Speech Types for TS
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export default function InterviewBuddy() {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [roleTitle, setRoleTitle] = useState("");
  const [level, setLevel] = useState("mid");
  const [mode, setMode] = useState("mock");
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Speech Recognition States
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    loadHistory();
    // Initialize Web Speech Recognition
    const win = window as unknown as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => (prev + " " + finalTranscript).trim());
        }
      };

      rec.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      setRecognition(rec);
    }
  }, []);

  const loadHistory = async () => {
    try {
      const historyList = await aiController.getInterviewHistory();
      setSessions(historyList);
    } catch (err) {
      console.error("Failed to load interview history:", err);
    }
  };

  const startSession = async () => {
    if (!roleTitle) return;
    setBusy(true);
    setError(null);
    try {
      const result = await aiController.startInterviewSession(roleTitle, level, mode);
      setActiveSession(result.session);
      setQuestions(result.questions);
      await loadHistory();
    } catch (err) {
      console.error("Failed to start session:", err);
      setError("Unable to start interview session.");
    } finally {
      setBusy(false);
    }
  };

  const speakQuestion = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel(); // Stop current speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-speech not supported in this browser.");
    }
  };

  const toggleRecording = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser (Use Chrome or Edge).");
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      recognition.start();
    }
  };

  const submitResponse = async (questionId: number) => {
    if (!transcript) return;
    setBusy(true);
    try {
      const result = await aiController.submitInterviewResponse(questionId, transcript);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, response: result.response } : q
        )
      );
      setTranscript("");
      if (activeSession) {
        setActiveSession({
          ...activeSession,
          answered_count: result.sessionProgress.answered,
          avg_score: result.sessionProgress.avg_score,
        });
      }
    } catch (err) {
      console.error("Failed to submit response:", err);
      setError("Failed to grade response.");
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    setBusy(true);
    try {
      await aiController.endInterviewSession(activeSession.id);
      setActiveSession(null);
      setQuestions([]);
      await loadHistory();
    } catch (err) {
      console.error("Failed to end session:", err);
      setActiveSession(null);
      setQuestions([]);
      await loadHistory();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="interview-buddy card full">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Interview Buddy</h2>
          <p className="subtitle" style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>Simulate real interviews, listen to audio questions, and record your voice with AI feedback.</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      {!activeSession && (
        <div className="preference-form">
          <h3>Configure Mock Interview</h3>
          <div className="form-grid">
            <input
              placeholder="Role title (e.g. Product Manager)"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
            />
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="entry">Entry Level</option>
              <option value="mid">Mid Level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </select>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="mock">Mock Interview Mode</option>
              <option value="buddy">Buddy Mentorship Mode</option>
            </select>
          </div>
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button onClick={startSession} disabled={busy || !roleTitle}>
              {busy ? "Starting..." : "Start Session"}
            </button>
          </div>
        </div>
      )}

      {activeSession && (
        <div className="active-session" style={{ marginTop: '1rem' }}>
          <div className="session-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                {activeSession.role_title} ({activeSession.level.toUpperCase()}) · {activeSession.mode.toUpperCase()}
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#64748b' }}>
                Progress: {activeSession.answered_count} / {activeSession.total_questions} | Average Score: {activeSession.avg_score ? `${activeSession.avg_score}%` : "—"}
              </p>
            </div>
            <button className="btn-danger" onClick={endSession} disabled={busy} style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
              End Session
            </button>
          </div>

          <div className="questions" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {questions.map((q) => (
              <div key={q.id} className="question-card" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div className="question-meta" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span className="badge" style={{ background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{q.category}</span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Difficulty {q.difficulty}/5</span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <p className="question-text" style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', margin: 0, flexGrow: 1 }}>{q.question_text}</p>
                  <button 
                    type="button" 
                    onClick={() => speakQuestion(q.question_text)} 
                    style={{ background: '#e0e7ff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    title="Speak Question"
                  >
                    🔊
                  </button>
                </div>

                {!q.response && (
                  <div className="response-form" style={{ marginTop: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        rows={4}
                        placeholder="Type or click '🎙️ Record Answer' to dictate..."
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                      {isRecording && (
                        <div style={{ position: 'absolute', bottom: '15px', right: '15px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fee2e2', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold' }}>
                          <span className="recording-dot" style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></span>
                          RECORDING
                        </div>
                      )}
                    </div>
                    <div className="form-actions" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={toggleRecording}
                        style={{ background: isRecording ? '#ef4444' : '#f1f5f9', color: isRecording ? 'white' : '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {isRecording ? "🛑 Stop Recording" : "🎙️ Record Answer"}
                      </button>
                      <button
                        onClick={() => submitResponse(q.id)}
                        disabled={busy || !transcript}
                        className="btn-primary"
                        style={{ padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600 }}
                      >
                        {busy ? "Analyzing..." : "Submit Answer"}
                      </button>
                    </div>
                  </div>
                )}

                {q.response && (
                  <div className="feedback" style={{ marginTop: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div className="score-bar" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                      <span style={{ fontWeight: 'bold', color: '#1e293b' }}>AI Score: {q.response.overall_score}/100</span>
                      <div style={{ background: '#e2e8f0', borderRadius: '4px', width: '100%', height: '8px', overflow: 'hidden' }}>
                        <div
                          className="bar"
                          style={{
                            width: `${q.response.overall_score}%`,
                            height: '100%',
                            background:
                              q.response.overall_score >= 80
                                ? "#22c55e"
                                : q.response.overall_score >= 60
                                ? "#f59e0b"
                                : "#ef4444",
                          }}
                        />
                      </div>
                    </div>
                    <p className="feedback-text" style={{ fontSize: '0.95rem', color: '#334155', lineHeight: 1.6, margin: '0 0 1rem 0' }}>{q.response.ai_feedback}</p>
                    <div className="rubric" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {Object.entries(q.response.scores_json).map(
                        ([key, score]) => (
                          <div key={key} className="rubric-item" style={{ background: 'white', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                            <span style={{ color: '#64748b' }}>{key}:</span>
                            <strong style={{ color: '#1e293b' }}>{score}/10</strong>
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

      <div className="history" style={{ marginTop: '2rem' }}>
        <h3>Past Performance History</h3>
        {sessions.length === 0 && <p>No history entries found.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sessions.map((s) => (
            <div key={s.id} className="history-row" style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                {s.role_title} ({s.level.toUpperCase()})
              </span>
              <span style={{ color: '#475569' }}>
                Progress: {s.answered_count}/{s.total_questions} | Score: {s.avg_score ? `${s.avg_score}%` : "—"}
              </span>
              <span className={`status ${s.status}`} style={{
                textTransform: 'uppercase',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: s.status === 'completed' ? '#166534' : '#b45309'
              }}>{s.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
