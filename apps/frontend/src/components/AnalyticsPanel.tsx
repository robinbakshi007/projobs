// components/AnalyticsPanel.tsx
import { useState, useEffect } from "react";
import { analyticsController } from "../controllers/AnalyticsController";
import type { AnalyticsSummary } from "../services/AnalyticsService";

export default function AnalyticsPanel() {
  const [metrics, setMetrics] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    setMetrics(analyticsController.getSummaryMetrics());
  }, []);

  if (!metrics) return <p>Loading CareerOS analytics...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div>
        <h2 style={{ margin: 0 }}>Executive Career Analytics</h2>
        <p className="subtitle" style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>Actionable insights monitoring funnel conversion ratios, salary values, and technical skills gaps.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <div className="card sf-metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Applications</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0' }}>{metrics.totalApplications}</div>
          <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>87% submit rate</span>
        </div>
        <div className="card sf-metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Active Interviews</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0' }}>{metrics.totalInterviews}</div>
          <span style={{ color: '#8b5cf6', fontSize: '0.8rem', fontWeight: 600 }}>18.4% conversion</span>
        </div>
        <div className="card sf-metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Offers Secured</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0' }}>{metrics.totalOffers}</div>
          <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>1 active offer</span>
        </div>
        <div className="card sf-metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #ec4899' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Salary Pipeline</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0' }}>{metrics.salaryPipeline}</div>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Est. market value</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
        <div className="card">
          <h3>Funnel Conversion Ratio</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
            {Object.entries(metrics.funnel).map(([stage, count]) => {
              const max = metrics.funnel.discovered;
              const percentage = ((count / max) * 100).toFixed(0);

              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ width: '100px', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'capitalize', color: '#475569' }}>{stage}</span>
                  <div style={{ flexGrow: 1, background: '#e2e8f0', borderRadius: '4px', height: '16px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ background: '#3b82f6', width: `${percentage}%`, height: '100%' }} />
                    <span style={{ position: 'absolute', right: '8px', top: '0', fontSize: '0.75rem', fontWeight: 'bold', color: '#1e293b', lineHeight: '16px' }}>{count}</span>
                  </div>
                  <span style={{ width: '40px', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'right', color: '#64748b' }}>{percentage}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>Career Competency Audit</h3>
          <p className="subtitle" style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Based on ATS resume optimizations, these are your matching strengths and skills gaps.</p>
          
          <div>
            <strong style={{ fontSize: '0.8rem', color: '#166534', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>✓ Key Strengths</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {metrics.skillsGap.strong.map(s => (
                <span key={s} className="badge-match-reason" style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 'bold' }}>{s}</span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <strong style={{ fontSize: '0.8rem', color: '#991b1b', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>⚠️ Skills Gaps</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {metrics.skillsGap.weak.map(s => (
                <span key={s} className="badge-missing-reason" style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: '#ffe4e6', color: '#991b1b', fontWeight: 'bold' }}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
