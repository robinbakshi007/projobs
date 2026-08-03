// components/RecruiterCRM.tsx
import React, { useState, useEffect } from 'react';
import { recruiterController } from '../controllers/RecruiterController';
import type { RecruiterContact, Interaction } from '../services/RecruiterService';
import { eventBus } from '../core/EventBus';

export default function RecruiterCRM() {
  const [contacts, setContacts] = useState<RecruiterContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // Add contact form states
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<RecruiterContact['status']>('discovered');
  const [nextStep, setNextStep] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Add interaction form states
  const [intType, setIntType] = useState<Interaction['type']>('call');
  const [intSummary, setIntSummary] = useState('');
  const [intNotes, setIntNotes] = useState('');
  const [showIntForm, setShowIntForm] = useState(false);

  useEffect(() => {
    setContacts(recruiterController.getContacts());

    const unsub = eventBus.subscribe("recruiter.contacted", () => {
      setContacts([...recruiterController.getContacts()]);
    });

    return unsub;
  }, []);

  const selectedContact = contacts.find(c => c.id === selectedContactId) || null;

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !company) return;

    const newContact: RecruiterContact = {
      id: `rec-${Date.now()}`,
      name,
      company,
      email,
      status,
      nextStep,
      followUpDate,
      notes,
      jobWorkspaceId: workspaceId ? Number(workspaceId) : undefined,
      interactions: []
    };

    recruiterController.saveContact(newContact);
    setName('');
    company && setCompany('');
    setEmail('');
    setStatus('discovered');
    setNextStep('');
    setFollowUpDate('');
    setNotes('');
    setWorkspaceId('');
    setShowAddForm(false);
  };

  const handleAddInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !intSummary) return;

    recruiterController.addInteraction(selectedContactId, {
      type: intType,
      summary: intSummary,
      notes: intNotes
    });

    setIntSummary('');
    setIntNotes('');
    setShowIntForm(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedContact ? '1fr 340px' : '1fr', gap: '1.5rem', height: '100%' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        <div className="crm-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Recruiter CRM</h2>
            <p className="subtitle" style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>Track recruiter relations, interaction logs, and AI outreach templates.</p>
          </div>
          <button className="btn-primary" onClick={() => { setShowAddForm(!showAddForm); setSelectedContactId(null); }}>
            {showAddForm ? 'View Contacts' : '+ Add Recruiter'}
          </button>
        </div>

        {showAddForm ? (
          <form onSubmit={handleAddContact} className="preference-form" style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3>Create Contact Record</h3>
            <div className="form-grid">
              <input placeholder="Recruiter Name *" value={name} onChange={e => setName(e.target.value)} required />
              <input placeholder="Company Name *" value={company} onChange={e => setCompany(e.target.value)} required />
              <input placeholder="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <select value={status} onChange={e => setStatus(e.target.value as RecruiterContact['status'])}>
                <option value="discovered">Discovered</option>
                <option value="contacted">Contacted</option>
                <option value="interviewing">Interviewing</option>
                <option value="offer">Offer Received</option>
                <option value="rejected">Rejected / Closed</option>
              </select>
              <input placeholder="Next Action Step" value={nextStep} onChange={e => setNextStep(e.target.value)} />
              <input placeholder="Follow-up Reminder Date" type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
              <input placeholder="Linked Job Workspace ID (Optional)" value={workspaceId} onChange={e => setWorkspaceId(e.target.value.replace(/[^0-9]/g, ''))} />
              <input placeholder="Add Notes/Context..." className="full" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="submit">Save Recruiter</button>
              <button type="button" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '1rem' }}>Recruiter</th>
                  <th style={{ padding: '1rem' }}>Company</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem' }}>Next Step</th>
                  <th style={{ padding: '1rem' }}>Follow Up</th>
                  <th style={{ padding: '1rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedContactId === c.id ? '#f1f5f9' : 'transparent' }} onClick={() => setSelectedContactId(c.id)}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.email || 'No email provided'}</div>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{c.company}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`status-pill status-${c.status}`} style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '50px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        background: c.status === 'interviewing' ? '#dbeafe' : c.status === 'offer' ? '#dcfce7' : c.status === 'contacted' ? '#fef3c7' : c.status === 'rejected' ? '#fee2e2' : '#f1f5f9',
                        color: c.status === 'interviewing' ? '#1e40af' : c.status === 'offer' ? '#166534' : c.status === 'contacted' ? '#b45309' : c.status === 'rejected' ? '#991b1b' : '#475569'
                      }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem', maxWidth: '250px' }}>
                      <div>{c.nextStep}</div>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#475569' }}>
                      {c.followUpDate ? new Date(c.followUpDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button onClick={(e) => { e.stopPropagation(); recruiterController.deleteContact(c.id); if (selectedContactId === c.id) setSelectedContactId(null); }} style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No recruiter contacts found. Click "+ Add Recruiter" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedContact && (
        <aside className="sf-ai-copilot-panel" style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', height: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>👤 Recruiter details</h3>
            <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b' }} onClick={() => setSelectedContactId(null)}>✕ Close</button>
          </div>

          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>Name: <strong>{selectedContact.name}</strong></div>
            <div>Company: <strong>{selectedContact.company}</strong></div>
            <div>Status: <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{selectedContact.status}</span></div>
            {selectedContact.jobWorkspaceId && <div>Linked Workspace: <strong>Workspace #{selectedContact.jobWorkspaceId}</strong></div>}
            <div style={{ fontStyle: 'italic', background: '#f8fafc', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              Notes: {selectedContact.notes || 'No notes.'}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }}>Interactions Log</h5>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', marginBottom: '0.5rem' }}>
              {selectedContact.interactions.map(i => (
                <div key={i.id} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '0.15rem' }}>
                    <span style={{ textTransform: 'uppercase' }}>{i.type}</span>
                    <span>{i.date}</span>
                  </div>
                  <div><strong>{i.summary}</strong></div>
                  {i.notes && <div style={{ color: '#64748b', fontStyle: 'italic', marginTop: '0.1rem' }}>{i.notes}</div>}
                </div>
              ))}
              {selectedContact.interactions.length === 0 && (
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>No logged interactions.</p>
              )}
            </div>

            {showIntForm ? (
              <form onSubmit={handleAddInteraction} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                <select value={intType} onChange={e => setIntType(e.target.value as Interaction['type'])} style={{ padding: '0.2rem', fontSize: '0.75rem' }}>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="meeting">Meeting</option>
                </select>
                <input placeholder="Summary (e.g. Discussed Salary)" value={intSummary} onChange={e => setIntSummary(e.target.value)} required style={{ padding: '0.25rem', fontSize: '0.75rem' }} />
                <input placeholder="Notes detail..." value={intNotes} onChange={e => setIntNotes(e.target.value)} style={{ padding: '0.25rem', fontSize: '0.75rem' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <button type="submit" className="btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Log</button>
                  <button type="button" className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => setShowIntForm(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <button className="btn-secondary" style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem' }} onClick={() => setShowIntForm(true)}>+ Log Interaction</button>
            )}
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem', marginTop: 'auto' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }}>AI Outreach Template</h5>
            <textarea
              readOnly
              value={recruiterController.getOutreachTemplate(selectedContact, "Staff Frontend Engineer")}
              style={{ width: '100%', height: '100px', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontFamily: 'monospace', resize: 'none', background: '#fafafa' }}
            />
            <button className="btn-primary" style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', fontSize: '0.75rem', marginTop: '0.25rem' }} onClick={() => {
              navigator.clipboard.writeText(recruiterController.getOutreachTemplate(selectedContact, "Staff Frontend Engineer"));
              alert("Outreach template copied to clipboard!");
            }}>
              📋 Copy outreach email
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
