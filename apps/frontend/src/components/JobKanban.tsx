// components/JobKanban.tsx
import { useState, useEffect } from "react";
import { jobController } from "../controllers/JobController";
import type { JobResult } from "../services/JobService";
import { eventBus } from "../core/EventBus";

const STAGES = [
  { id: "new", name: "Discovered" },
  { id: "viewed", name: "Analysed" },
  { id: "tailored", name: "Tailored" },
  { id: "applied", name: "Applied" },
  { id: "recruiter", name: "Recruiter Contact" },
  { id: "interviewing", name: "Interviewing" },
  { id: "offer", name: "Offer" },
  { id: "rejected", name: "Closed/Rejected" }
];

export default function JobKanban() {
  const [jobs, setJobs] = useState<JobResult[]>([]);

  useEffect(() => {
    setJobs(jobController.getResults());

    const unsub = eventBus.subscribe("analytics.refreshed", () => {
      setJobs([...jobController.getResults()]);
    });

    return unsub;
  }, []);

  const moveJob = (jobId: number, nextStatus: string) => {
    jobController.updateStatus(jobId, nextStatus);
    setJobs([...jobController.getResults()]);
  };

  return (
    <div className="card full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflow: 'hidden' }}>
      <div>
        <h2 style={{ margin: 0 }}>Application Lifecycle Board</h2>
        <p className="subtitle" style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>Track active roles across the complete recruitment funnel. Move jobs between stages.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '0.75rem', overflowX: 'auto', flexGrow: 1, paddingBottom: '1rem', minHeight: '500px' }}>
        {STAGES.map((stage) => {
          const stageJobs = jobs.filter((j) => {
            if (stage.id === "new") return j.status === "new" || !j.status;
            return j.status === stage.id;
          });

          return (
            <div key={stage.id} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '150px', maxHeight: '600px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#334155' }}>{stage.name}</span>
                <span style={{ background: '#cbd5e1', color: '#334155', borderRadius: '50px', padding: '0.1rem 0.4rem', fontSize: '0.75rem', fontWeight: 'bold' }}>{stageJobs.length}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {stageJobs.map((job) => (
                  <div key={job.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b' }}>{job.title}</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{job.company}</span>
                    <span style={{ background: '#f1f5f9', alignSelf: 'flex-start', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', color: '#475569' }}>
                      ATS: {(Number(job.preference_score_10 || 8.5) * 10).toFixed(0)}%
                    </span>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.25rem', marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                      <button 
                        type="button" 
                        style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        disabled={stage.id === "new"}
                        onClick={() => {
                          const prevIdx = STAGES.findIndex(s => s.id === stage.id) - 1;
                          moveJob(job.id, STAGES[prevIdx].id);
                        }}
                      >
                        ◀
                      </button>
                      <button 
                        type="button" 
                        style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        disabled={stage.id === "rejected"}
                        onClick={() => {
                          const nextIdx = STAGES.findIndex(s => s.id === stage.id) + 1;
                          moveJob(job.id, STAGES[nextIdx].id);
                        }}
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                ))}

                {stageJobs.length === 0 && (
                  <div style={{ padding: '2rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
