import { useEffect, useState } from 'react';

export type RoutineDraft = {
  id?: string;
  name: string;
  description: string;
  actionType: string;
  priority: 'low'|'normal'|'high'|'urgent';
  recurrence: 'once'|'daily'|'weekly'|'monthly';
  startDate: string;
  dueDate?: string;
  dueTime: string;
  weekday?: number;
  monthDay?: number;
  requiredPermission: string;
  timezone: string;
  expectedDurationMinutes?: number | null;
  requiredEvidence: 'checklist'|'photo'|'checklist_and_photo';
  approvalRequired: boolean;
  escalation: { afterMinutes: number; notifyRoleSetId?: string };
  dependencies: string[];
  activeFrom?: string;
  activeUntil?: string;
  financialImpactAmount?: number | null;
  currency: string;
  steps: Array<{ label: string; required: boolean }>;
  assignments: Array<{ type: 'user'|'role'|'group'|'location'; targetId: string; label: string; locationId?: string }>;
};

type Props = {
  workspaceId: string;
  api: <T>(resource: string, options?: { method?: 'GET'|'POST'|'PUT'|'DELETE'; payload?: unknown }) => Promise<T>;
  assignmentOptions: Array<{ type: 'user'|'role'|'group'|'location'; id: string; label: string }>;
};

const empty = (): RoutineDraft => ({
  name: '', description: '', actionType: 'routine_checklist', priority: 'normal', recurrence: 'daily',
  startDate: new Date().toISOString().slice(0, 10), dueTime: '17:00', weekday: 1, monthDay: 1,
  requiredPermission: 'nav-tasks', timezone: 'Africa/Johannesburg', expectedDurationMinutes: null, requiredEvidence: 'checklist', approvalRequired: false,
  escalation: { afterMinutes: 30 }, dependencies: [], activeFrom: new Date().toISOString().slice(0, 10), activeUntil: '', financialImpactAmount: null, currency: 'ZAR',
  steps: [{ label: '', required: true }], assignments: []
});

export function KcpFlowRoutinesAdmin({ api, assignmentOptions }: Props) {
  const [routines, setRoutines] = useState<any[]>([]);
  const [draft, setDraft] = useState<RoutineDraft>(empty());
  const [message, setMessage] = useState('');
  const load = () => api<{ routines: any[] }>('routines').then((response) => setRoutines(response.routines));
  useEffect(() => { void load(); }, []);

  async function save() {
    setMessage('');
    if (!draft.name.trim() || !draft.steps.some((step) => step.label.trim()) || !draft.assignments.length) {
      setMessage('Name, completion steps and at least one assignment are required.'); return;
    }
    await api(`routines${draft.id ? `/${encodeURIComponent(draft.id)}` : ''}`, { method: draft.id ? 'PUT' : 'POST', payload: draft });
    setDraft(empty()); setMessage('Routine saved.'); await load();
  }

  function edit(item: any) {
    setDraft({
      id: item.id, name: item.name, description: item.description || '', actionType: item.actionType || 'routine_checklist',
      priority: item.priority, recurrence: item.recurrence, startDate: item.start_date, dueDate: item.due_date || '',
      dueTime: item.due_time, weekday: item.weekday, monthDay: item.month_day,
      requiredPermission: item.requiredPermission || 'nav-tasks', timezone: item.timezone || 'Africa/Johannesburg', expectedDurationMinutes: item.expectedDurationMinutes ?? null,
      requiredEvidence: item.requiredEvidence || 'checklist', approvalRequired: item.approvalRequired === true, escalation: item.escalation || { afterMinutes: 30 }, dependencies: item.dependencies || [], activeFrom: item.activeFrom || item.start_date, activeUntil: item.activeUntil || '', financialImpactAmount: item.financialImpact?.amount ?? null,
      currency: item.financialImpact?.currency || 'ZAR', steps: item.steps,
      assignments: item.assignments.map((assignment: any) => ({ type: assignment.type === 'role_set' ? 'role' : assignment.type, targetId: assignment.targetId, label: assignment.label, locationId: assignment.locationId }))
    });
  }

  return <section className="task-template-admin">
    <header><div><p>KCP Flow</p><h1>Routines</h1></div><button type="button" onClick={() => setDraft(empty())}>New Routine</button></header>
    {message && <div role="status">{message}</div>}
    <div className="task-template-layout"><aside>{routines.map((item) => <button type="button" key={item.id} onClick={() => edit(item)}><strong>{item.name}</strong><small>{item.recurrence} · {item.assignments.length} assignment(s)</small></button>)}</aside>
      <main><label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <div><label>Action type<input value={draft.actionType} onChange={(event) => setDraft({ ...draft, actionType: event.target.value })} /></label><label>Priority<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as RoutineDraft['priority'] })}>{['low','normal','high','urgent'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Recurrence<select value={draft.recurrence} onChange={(event) => setDraft({ ...draft, recurrence: event.target.value as RoutineDraft['recurrence'] })}>{['once','daily','weekly','monthly'].map((value) => <option key={value}>{value}</option>)}</select></label></div>
        <div><label>Due time<input type="time" value={draft.dueTime} onChange={(event) => setDraft({ ...draft, dueTime: event.target.value })} /></label><label>Timezone<select value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}><option value="Africa/Johannesburg">Africa/Johannesburg</option></select></label><label>Expected duration (minutes)<input type="number" min="1" max="1440" value={draft.expectedDurationMinutes ?? ''} onChange={(event) => setDraft({ ...draft, expectedDurationMinutes: event.target.value === '' ? null : Number(event.target.value) })} /></label></div>
        <div><label>Required evidence<select value={draft.requiredEvidence} onChange={(event) => setDraft({ ...draft, requiredEvidence: event.target.value as RoutineDraft['requiredEvidence'] })}><option value="checklist">Checklist</option><option value="photo">Photo evidence</option><option value="checklist_and_photo">Checklist and photo</option></select></label><label>Escalate after (minutes)<input type="number" min="0" value={draft.escalation.afterMinutes} onChange={(event) => setDraft({ ...draft, escalation: { ...draft.escalation, afterMinutes: Number(event.target.value) } })} /></label><label>Financial impact (optional)<input type="number" min="0" step="0.01" value={draft.financialImpactAmount ?? ''} onChange={(event) => setDraft({ ...draft, financialImpactAmount: event.target.value === '' ? null : Number(event.target.value) })} /></label></div>
        <label><span><input type="checkbox" checked={draft.approvalRequired} onChange={(event) => setDraft({ ...draft, approvalRequired: event.target.checked })} /> Approval required before completion</span></label>
        <label>Depends on routine IDs (comma-separated)<input value={draft.dependencies.join(', ')} placeholder="opening-check, receiving-review" onChange={(event) => setDraft({ ...draft, dependencies: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} /></label>
        <div><label>Active from<input type="date" value={draft.activeFrom || ''} onChange={(event) => setDraft({ ...draft, activeFrom: event.target.value })} /></label><label>Active until (optional)<input type="date" value={draft.activeUntil || ''} onChange={(event) => setDraft({ ...draft, activeUntil: event.target.value })} /></label><label>Required permission<input value={draft.requiredPermission} onChange={(event) => setDraft({ ...draft, requiredPermission: event.target.value })} /></label></div>
        {draft.recurrence === 'once' && <label>Due date<input type="date" value={draft.dueDate || ''} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label>}
        {draft.recurrence === 'weekly' && <label>Weekday<select value={draft.weekday ?? 1} onChange={(event) => setDraft({ ...draft, weekday: Number(event.target.value) })}>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((label, index) => <option value={index} key={label}>{label}</option>)}</select></label>}
        {draft.recurrence === 'monthly' && <label>Day of month<input type="number" min="1" max="31" value={draft.monthDay ?? 1} onChange={(event) => setDraft({ ...draft, monthDay: Number(event.target.value) })} /></label>}
        <h2>Completion evidence</h2>{draft.steps.map((step, index) => <label key={index}>Step {index + 1}<input value={step.label} onChange={(event) => setDraft({ ...draft, steps: draft.steps.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, label: event.target.value } : candidate) })} /><span><input type="checkbox" checked={step.required} onChange={(event) => setDraft({ ...draft, steps: draft.steps.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, required: event.target.checked } : candidate) })} /> Required</span></label>)}<button type="button" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { label: '', required: true }] })}>Add evidence step</button>
        <h2>Assign to a user, Role Set or Action Group</h2>{assignmentOptions.map((option) => { const selected = draft.assignments.some((assignment) => assignment.type === option.type && assignment.targetId === option.id); return <label key={`${option.type}:${option.id}`}><span><input type="checkbox" checked={selected} onChange={() => setDraft({ ...draft, assignments: selected ? draft.assignments.filter((assignment) => !(assignment.type === option.type && assignment.targetId === option.id)) : [...draft.assignments, { type: option.type, targetId: option.id, label: option.label, locationId: option.type === 'location' ? option.id : undefined }] })} />{option.label} <small>{option.type === 'role' ? 'Role Set' : option.type === 'group' ? 'Action Group' : option.type}</small></span></label>; })}
        <div className="task-template-actions">{draft.id && <button type="button" onClick={async () => { await api(`routines/${encodeURIComponent(draft.id!)}`, { method: 'DELETE' }); setDraft(empty()); setMessage('Routine deactivated.'); await load(); }}>Deactivate</button>}<button type="button" onClick={() => void save()}>Save Routine</button></div>
      </main>
    </div>
  </section>;
}
