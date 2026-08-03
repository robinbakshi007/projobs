import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";
const OLLAMA_BASE = import.meta.env.VITE_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

interface AgentTask {
  id: number;
  agent_id: string;
  task_type: string;
  status: string;
  payload_json: Record<string, unknown> | null;
  result_json: Record<string, unknown> | null;
  extension_ref: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface AutoSubmitPolicyView {
  tenant_id: number;
  global_enabled: boolean;
  tenant_enabled: boolean;
  effective_enabled: boolean;
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

export default function AgentDashboard() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [agentId, setAgentId] = useState("cv_tailor");
  const [taskType, setTaskType] = useState("tailor_cv");
  const [payload, setPayload] = useState('{"job_id": 1}');
  const [orchestrateMode, setOrchestrateMode] = useState(false);
  const [orchestrateAgents, setOrchestrateAgents] = useState(
    '[\n  {"agent_id": "cv_tailor", "task_type": "tailor_cv"},\n  {"agent_id": "cover_writer", "task_type": "write_cover"},\n  {"agent_id": "seek_applier", "task_type": "apply_seek"}\n]'
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ollamaBusy, setOllamaBusy] = useState(false);
  const [ollamaModel, setOllamaModel] = useState("gemma4:12b");
  const [ollamaPrompt, setOllamaPrompt] = useState("Reply with OK_FROM_PROJOBS");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaResponse, setOllamaResponse] = useState<string>("");
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [policyView, setPolicyView] = useState<AutoSubmitPolicyView | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [policyStatus, setPolicyStatus] = useState<string>("");

  useEffect(() => {
    loadTasks();
    loadPolicy();
  }, []);

  const loadTasks = async () => {
    try {
      const response = await fetch(`${API}/agent-tasks`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const body = await response.json();
        setTasks(body.data ?? []);
        return;
      }
      // Keep dashboard usable when backend auth/API is unavailable.
      setTasks([]);
    } catch {
      setTasks([]);
    }
  };

  const dispatchTask = async () => {
    setBusy(true);
    setError(null);
    try {
      let payloadJson: Record<string, unknown> | null = null;
      try {
        payloadJson = JSON.parse(payload);
      } catch {
        payloadJson = null;
      }

      const response = await fetch(`${API}/agent-tasks`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          agent_id: agentId,
          task_type: taskType,
          payload_json: payloadJson,
        }),
      });
      if (!response.ok) throw new Error(`Dispatch failed (${response.status})`);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispatch failed");
    } finally {
      setBusy(false);
    }
  };

  const orchestrate = async () => {
    setBusy(true);
    setError(null);
    try {
      let agents: unknown[] = [];
      try {
        agents = JSON.parse(orchestrateAgents);
      } catch {
        throw new Error("Invalid agents JSON");
      }

      const response = await fetch(`${API}/agent-tasks/orchestrate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          strategy: "sequential",
          agents,
        }),
      });
      if (!response.ok) throw new Error(`Orchestrate failed (${response.status})`);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Orchestrate failed");
    } finally {
      setBusy(false);
    }
  };

  const updateTask = async (taskId: number, status: string) => {
    try {
      await fetch(`${API}/agent-tasks/${taskId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      await loadTasks();
    } catch {
      setError("Update failed");
    }
  };

  const loadOllamaModels = async () => {
    setOllamaBusy(true);
    setOllamaError(null);
    try {
      const response = await fetch(`${OLLAMA_BASE}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama /api/tags failed (${response.status})`);
      }

      const body = await response.json();
      const models = Array.isArray(body?.models)
        ? body.models
            .map((m: { name?: unknown }) => (typeof m.name === "string" ? m.name : ""))
            .filter(Boolean)
        : [];

      setOllamaModels(models);
      if (models.length > 0 && !models.includes(ollamaModel)) {
        setOllamaModel(models[0]);
      }
    } catch (err) {
      setOllamaError(err instanceof Error ? err.message : "Could not reach Ollama");
    } finally {
      setOllamaBusy(false);
    }
  };

  const loadPolicy = async () => {
    setPolicyLoading(true);
    setPolicyError(null);
    try {
      const response = await fetch(`${API}/automation/auto-submit-policy`, {
        headers: authHeaders(),
      });

      if (response.status === 403) {
        setPolicyError("Tenant admin access is required to view auto-submit policy.");
        setPolicyView(null);
        return;
      }

      if (!response.ok) {
        throw new Error(`Policy check failed (${response.status})`);
      }

      const body = await response.json();
      setPolicyView(body as AutoSubmitPolicyView);
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : "Could not load policy status");
      setPolicyView(null);
    } finally {
      setPolicyLoading(false);
    }
  };

  const updatePolicy = async (enabled: boolean) => {
    setPolicySaving(true);
    setPolicyError(null);
    setPolicyStatus("Saving policy...");

    try {
      const response = await fetch(`${API}/automation/auto-submit-policy`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ enabled }),
      });

      if (response.status === 403) {
        throw new Error("Tenant admin access is required to update policy.");
      }

      if (!response.ok) {
        throw new Error(`Policy update failed (${response.status})`);
      }

      const body = (await response.json()) as AutoSubmitPolicyView;
      setPolicyView(body);
      setPolicyStatus(enabled ? "Auto-submit enabled for this tenant." : "Auto-submit disabled for this tenant.");
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : "Could not update policy");
      setPolicyStatus("");
    } finally {
      setPolicySaving(false);
    }
  };

  const testOllamaModel = async () => {
    setOllamaBusy(true);
    setOllamaError(null);
    setOllamaResponse("");

    try {
      const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: ollamaPrompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama /api/generate failed (${response.status}): ${text}`);
      }

      const body = await response.json();
      const reply = typeof body?.response === "string" ? body.response : "No response text returned.";
      setOllamaResponse(reply);
    } catch (err) {
      setOllamaError(err instanceof Error ? err.message : "Model test failed");
    } finally {
      setOllamaBusy(false);
    }
  };

  return (
    <div className="agent-dashboard">
      <h2>Multi-Agent Orchestration</h2>
      <p className="subtitle">
        Extension: RobinBakshi/ollama-direct-custom-agent
      </p>
      {error && <p className="error">{error}</p>}

      <div className="policy-card">
        <h3>Apply Automation Policy</h3>
        {policyLoading && <p className="subtitle">Loading policy...</p>}
        {!policyLoading && policyView && (
          <>
            <div className="policy-grid">
              <div><strong>Global:</strong> {policyView.global_enabled ? "Enabled" : "Disabled"}</div>
              <div><strong>Tenant:</strong> {policyView.tenant_enabled ? "Enabled" : "Disabled"}</div>
              <div><strong>Effective:</strong> {policyView.effective_enabled ? "Enabled" : "Blocked"}</div>
            </div>
            {!policyView.effective_enabled && (
              <p className="policy-warning">
                Apply runs are blocked by policy. Enable tenant policy and ensure global worker auto-submit is enabled.
              </p>
            )}
            <div className="task-actions">
              <button onClick={() => updatePolicy(true)} disabled={policySaving}>
                {policySaving ? "Saving..." : "Enable Tenant Auto-Submit"}
              </button>
              <button onClick={() => updatePolicy(false)} disabled={policySaving}>
                {policySaving ? "Saving..." : "Disable Tenant Auto-Submit"}
              </button>
              <button onClick={loadPolicy} disabled={policyLoading || policySaving}>
                Refresh Policy
              </button>
            </div>
            {policyStatus && <p className="subtitle">{policyStatus}</p>}
          </>
        )}
        {policyError && <p className="error">{policyError}</p>}
      </div>

      <div className="ollama-card">
        <h3>Ollama Diagnostics</h3>
        <p className="subtitle">Endpoint: {OLLAMA_BASE}</p>
        <div className="dispatch-form">
          <div className="task-actions">
            <button onClick={loadOllamaModels} disabled={ollamaBusy}>
              {ollamaBusy ? "Checking..." : "List Models"}
            </button>
          </div>
          {ollamaModels.length > 0 && (
            <select
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
            >
              {ollamaModels.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          {ollamaModels.length === 0 && (
            <input
              placeholder="Model name (e.g. gemma4:12b)"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
            />
          )}
          <textarea
            rows={2}
            placeholder="Prompt"
            value={ollamaPrompt}
            onChange={(e) => setOllamaPrompt(e.target.value)}
          />
          <div className="task-actions">
            <button onClick={testOllamaModel} disabled={ollamaBusy || !ollamaModel.trim()}>
              {ollamaBusy ? "Testing..." : "Test Model"}
            </button>
          </div>
          {ollamaError && <p className="error">{ollamaError}</p>}
          {ollamaResponse && <pre className="ollama-output">{ollamaResponse}</pre>}
        </div>
      </div>

      <div className="mode-toggle">
        <button
          className={!orchestrateMode ? "active" : ""}
          onClick={() => setOrchestrateMode(false)}
        >
          Single Task
        </button>
        <button
          className={orchestrateMode ? "active" : ""}
          onClick={() => setOrchestrateMode(true)}
        >
          Orchestrate
        </button>
      </div>

      {!orchestrateMode && (
        <div className="dispatch-form">
          <input
            placeholder="Agent ID"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          />
          <input
            placeholder="Task Type"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
          />
          <textarea
            rows={3}
            placeholder='Payload JSON (e.g. {"job_id": 1})'
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
          <button onClick={dispatchTask} disabled={busy}>
            {busy ? "Dispatching..." : "Dispatch Task"}
          </button>
        </div>
      )}

      {orchestrateMode && (
        <div className="dispatch-form">
          <textarea
            rows={6}
            placeholder="Agents JSON array"
            value={orchestrateAgents}
            onChange={(e) => setOrchestrateAgents(e.target.value)}
          />
          <button onClick={orchestrate} disabled={busy}>
            {busy ? "Orchestrating..." : "Run Multi-Agent Flow"}
          </button>
        </div>
      )}

      <div className="tasks-list">
        <h3>Agent Tasks</h3>
        {tasks.length === 0 && <p>No tasks yet.</p>}
        {tasks.map((task) => (
          <div key={task.id} className="task-row">
            <div className="task-meta">
              <span className="agent-id">{task.agent_id}</span>
              <span className="task-type">{task.task_type}</span>
              <span className={`status ${task.status}`}>{task.status}</span>
            </div>
            <div className="task-details">
              <span>Extension: {task.extension_ref}</span>
              {task.started_at && (
                <span>Started: {new Date(task.started_at).toLocaleString()}</span>
              )}
              {task.completed_at && (
                <span>
                  Completed: {new Date(task.completed_at).toLocaleString()}
                </span>
              )}
            </div>
            <div className="task-actions">
              {task.status === "queued" && (
                <button onClick={() => updateTask(task.id, "running")}>
                  Mark Running
                </button>
              )}
              {task.status === "running" && (
                <>
                  <button onClick={() => updateTask(task.id, "succeeded")}>
                    Mark Succeeded
                  </button>
                  <button onClick={() => updateTask(task.id, "failed")}>
                    Mark Failed
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
