import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

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

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const response = await fetch(`${API}/agent-tasks`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const body = await response.json();
        setTasks(body.data ?? []);
      }
    } catch {
      setError("Failed to load tasks");
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

  return (
    <div className="agent-dashboard">
      <h2>Multi-Agent Orchestration</h2>
      <p className="subtitle">
        Extension: RobinBakshi/ollama-direct-custom-agent
      </p>
      {error && <p className="error">{error}</p>}

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
