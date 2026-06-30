// components/EmailCalendar.tsx
import { useState, useEffect } from "react";
import { emailCalendarController } from "../controllers/EmailCalendarController";
import type { TriagedEmail, CalendarEvent } from "../services/EmailCalendarService";
import { eventBus } from "../core/EventBus";

export default function EmailCalendar() {
  const [emails, setEmails] = useState<TriagedEmail[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [testSender, setTestSender] = useState("");
  const [testBody, setTestBody] = useState("");

  useEffect(() => {
    setEmails(emailCalendarController.getEmails());
    setEvents(emailCalendarController.getEvents());

    const emailUnsub = eventBus.subscribe("email.triaged", () => {
      setEmails([...emailCalendarController.getEmails()]);
    });

    const calendarUnsub = eventBus.subscribe("calendar.updated", () => {
      setEvents([...emailCalendarController.getEvents()]);
    });

    return () => {
      emailUnsub();
      calendarUnsub();
    };
  }, []);

  const triggerTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testSender) return;

    emailCalendarController.triageIncomingEmail({
      sender: testSender,
      subject: "Invitation to interview loop",
      body: testBody || "Let's schedule a 30-minute coding interview.",
      category: "interview",
    });

    setTestSender("");
    setTestBody("");
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', height: '100%' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        <div>
          <h3 style={{ margin: 0 }}>Recruiter Email Triage</h3>
          <p className="subtitle" style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>AI parses incoming inbox messages, auto-tagging recruiter contacts and loop invites.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {emails.map((m) => (
            <div key={m.id} style={{ background: '#f8fafc', borderLeft: `4px solid ${m.category === 'interview' ? '#3b82f6' : m.category === 'rejection' ? '#ef4444' : '#64748b'}`, padding: '1rem', borderRadius: '4px 8px 8px 4px', border: '1px solid #cbd5e1', borderLeftWidth: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem' }}>{m.sender}</strong>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{m.receivedAt}</span>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#334155', margin: '0.25rem 0' }}>{m.subject}</div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{m.body}</p>
              <span className={`status-pill status-${m.category}`} style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold', background: m.category === 'interview' ? '#dbeafe' : m.category === 'rejection' ? '#fee2e2' : '#f1f5f9', color: m.category === 'interview' ? '#1e40af' : m.category === 'rejection' ? '#991b1b' : '#475569' }}>
                {m.category}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={triggerTestEmail} style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0' }}>Simulate Incoming Recruiter Email</h4>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input 
              placeholder="Sender (e.g. Google HR)" 
              value={testSender} 
              onChange={e => setTestSender(e.target.value)} 
              required 
              style={{ flex: 1, padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '0.4rem 0.8rem' }}>Triage</button>
          </div>
          <input 
            placeholder="Message body..." 
            value={testBody} 
            onChange={e => setTestBody(e.target.value)} 
            style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
        </form>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        <div>
          <h3 style={{ margin: 0 }}>Smart Career Calendar</h3>
          <p className="subtitle" style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>Scheduled loops automatically book custom preparation buffers (STAR drills & research) in your calendar.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {events.map((e) => (
            <div key={e.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ background: e.type === 'interview' ? '#3b82f6' : e.type === 'research' ? '#8b5cf6' : e.type === 'star_practice' ? '#f59e0b' : '#10b981', color: 'white', borderRadius: '8px', width: '48px', height: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>{e.type.slice(0, 3)}</span>
                <span style={{ fontSize: '0.9rem' }}>{e.durationMinutes}m</span>
              </div>
              <div style={{ flexGrow: 1 }}>
                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{e.title}</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Start Time: {e.start.replace("T", " ")}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
