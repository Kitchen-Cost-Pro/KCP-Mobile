import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Camera, Check, CheckCircle2, ChevronRight, ClipboardList, CloudOff, History, LoaderCircle, MapPin, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import type { KcpLocation } from '../../types/kcp';
import { completeAction, deferAction, loadAction, loadActions, saveActionProgress } from '../flow/actionApi';
import { ACTION_STATUSES, actionStatusLabel, type ActionActivity, type ActionProgress, type ActionStatus, type KcpAction } from '../flow/actionModel';
import { taskRecoveryStore } from './taskRecoveryStore';
import { taskSnapshotStore } from './taskSnapshotStore';
import { taskCompletionQueue } from './taskCompletionQueue';
import type { RoleSet } from '../role-sets/roleSetModel';
import { BUILT_IN_ROLE_SETS, canSeeFinancialImpact, sortActionsForRoleSet } from '../role-sets/roleSetModel';

type Props = { workspaceId: string; userId: string; connected: boolean; location: KcpLocation | null; roleSet?: RoleSet; onLocation: () => void; initialActionId?: string };
type View = 'dashboard' | 'action' | 'history';

export function KcpFlowScreen({ workspaceId, userId, connected, location, roleSet, onLocation, initialActionId = '' }: Props) {
  const effectiveRoleSet = roleSet || BUILT_IN_ROLE_SETS[0];
  const [actions, setActions] = useState<KcpAction[]>([]);
  const [status, setStatus] = useState<ActionStatus>('ready');
  const [active, setActive] = useState<KcpAction | null>(null);
  const [progress, setProgress] = useState<ActionProgress | null>(null);
  const [history, setHistory] = useState<ActionActivity[]>([]);
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recovered, setRecovered] = useState(false);
  const openedTarget = useRef('');

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!location) { setActions([]); setLoading(false); return; }
    setLoading(true); setError('');
    if (!connected) {
      const saved = taskSnapshotStore.get(workspaceId, userId, location.id);
      setActions(saved?.actions || []);
      if (!saved) setError('No saved KCP Flow snapshot is available for this location.');
      setLoading(false); return;
    }
    try {
      const response = await loadActions(workspaceId, location.id, signal);
      setActions(response.actions);
      taskSnapshotStore.set(workspaceId, userId, location.id, response);
    } catch (cause) {
      if (!signal?.aborted) setError(message(cause, 'KCP Flow Actions could not be loaded.'));
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [connected, location, userId, workspaceId]);

  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh]);
  useEffect(() => { void taskRecoveryStore.get(workspaceId, userId).then((saved) => {
    if (!saved || saved.task.status === 'completed') return;
    setActive(saved.task); setProgress(saved.progress); setRecovered(true);
    setNotice('Recovered your unfinished Action securely.'); setView('action');
  }); }, [userId, workspaceId]);
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    void (async () => {
      const queued = await taskCompletionQueue.list(workspaceId, userId); let completed = 0;
      for (const item of queued) {
        if (cancelled) return;
        try { await completeAction(workspaceId, item.taskId, item.progress); await taskCompletionQueue.remove(workspaceId, userId, item.id); completed++; }
        catch { return; }
      }
      if (completed && !cancelled) { setNotice(`${completed} queued Action completion${completed === 1 ? '' : 's'} synchronised with KCP.`); await refresh(); }
    })();
    return () => { cancelled = true; };
  }, [connected, refresh, userId, workspaceId]);
  useEffect(() => {
    if (!active || !progress || view !== 'action' || active.status === 'completed') return;
    void taskRecoveryStore.set({ workspaceId, userId, task: active, progress, updatedAt: new Date().toISOString() }).catch(() => undefined);
  }, [active, progress, userId, view, workspaceId]);

  const counts = useMemo(() => Object.fromEntries(ACTION_STATUSES.map((item) => [item, actions.filter((action) => action.status === item).length])) as Record<ActionStatus, number>, [actions]);
  const visible = useMemo(() => sortActionsForRoleSet(actions.filter((action) => action.status === status), effectiveRoleSet), [actions, effectiveRoleSet, status]);

  async function openAction(action: KcpAction) {
    setError(''); setNotice('');
    if (!connected) { setActive(action); setProgress(fromAction(action)); setHistory([]); setView(action.status === 'completed' ? 'history' : 'action'); return; }
    setBusy(true);
    try {
      const response = await loadAction(workspaceId, action.id);
      setActive(response.action); setProgress(fromAction(response.action)); setHistory(response.history);
      setView(response.action.status === 'completed' ? 'history' : 'action');
    } catch (cause) { setError(message(cause, 'Action details could not be loaded.')); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!initialActionId || openedTarget.current === initialActionId) return;
    openedTarget.current = initialActionId;
    const cached = actions.find((action) => action.id === initialActionId);
    if (!connected) { if (cached) void openAction(cached); else setError('This Action is not available in the authorised offline snapshot.'); return; }
    setBusy(true);
    void loadAction(workspaceId, initialActionId).then((response) => {
      setActive(response.action); setProgress(fromAction(response.action)); setHistory(response.history);
      setView(response.action.status === 'completed' ? 'history' : 'action');
    }).catch((cause) => setError(message(cause, 'The linked Action is unavailable or no longer authorised.'))).finally(() => setBusy(false));
  }, [actions, connected, initialActionId, workspaceId]);

  function toggleStep(id: string) { setProgress((current) => current && ({ ...current, steps: current.steps.map((step) => step.id === id ? { ...step, completed: !step.completed } : step) })); }
  async function addPhoto(file?: File) {
    if (!file || !progress) return; setError('');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError('Use a JPEG, PNG or WebP photo.'); return; }
    if (file.size > 1_000_000) { setError('Photo evidence must be 1 MB or smaller.'); return; }
    const dataUrl = await readFile(file);
    setProgress({ ...progress, evidence: [...(progress.evidence || []), { clientId: crypto.randomUUID(), fileName: file.name.slice(0, 120), mimeType: file.type, dataUrl }] });
  }
  async function save() {
    if (!active || !progress || !connected) return; setBusy(true); setError('');
    try { const response = await saveActionProgress(workspaceId, active.id, progress); setActive(response.action); setProgress(fromAction(response.action)); setRecovered(true); setNotice('Action progress saved to KCP Flow.'); }
    catch (cause) { setError(message(cause, 'Progress could not be saved. Your secure device copy is still available.')); }
    finally { setBusy(false); }
  }
  async function complete() {
    if (!active || !progress) return;
    const required = active.steps.filter((step) => step.required);
    if (required.some((step) => !progress.steps.find((candidate) => candidate.id === step.id)?.completed)) { setError('Complete every required checklist item first.'); return; }
    if (!connected) {
      if (progress.evidence?.length) { setError('Reconnect before completing an Action with new photo evidence.'); return; }
      setBusy(true);
      try {
        await taskCompletionQueue.enqueue({ workspaceId, userId, taskId: active.id, progress: { ...progress, evidence: [] } });
        await taskRecoveryStore.clear(workspaceId, userId);
        setActions((items) => items.map((item) => item.id === active.id ? { ...item, status: 'completed', completedAt: new Date().toISOString() } : item));
        setView('dashboard'); setActive(null); setProgress(null); setStatus('completed');
        setNotice('Completion queued securely. It will synchronise after reconnecting.');
      } finally { setBusy(false); }
      return;
    }
    setBusy(true); setError('');
    try {
      await completeAction(workspaceId, active.id, progress); await taskRecoveryStore.clear(workspaceId, userId);
      setNotice('Action completed and added to KCP Flow history.'); setRecovered(false); setView('dashboard'); setActive(null); setProgress(null);
      await refresh(); setStatus('completed');
    } catch (cause) { setError(message(cause, 'Action completion failed. Refresh and try again.')); }
    finally { setBusy(false); }
  }
  async function defer() {
    if (!active || !connected || !effectiveRoleSet.canDefer) return;
    setBusy(true); setError('');
    try { await deferAction(workspaceId, active.id, active.revision, 'Deferred from KCP Lite'); await taskRecoveryStore.clear(workspaceId, userId); setNotice('Action deferred. Its escalation rules remain active.'); setView('dashboard'); setActive(null); setProgress(null); await refresh(); setStatus('deferred'); }
    catch (cause) { setError(message(cause, 'This Action could not be deferred.')); }
    finally { setBusy(false); }
  }
  function back() { setView('dashboard'); setActive(null); setProgress(null); setHistory([]); setError(''); setNotice(''); }

  if (view === 'history' && active) return <ActionHistory action={active} history={history} connected={connected} onBack={back} />;
  if (view === 'action' && active && progress) return <ActionDetail action={active} progress={progress} connected={connected} recovered={recovered} busy={busy} error={error} notice={notice} roleSet={effectiveRoleSet} onBack={back} onToggle={toggleStep} onNotes={(notes) => setProgress({ ...progress, notes })} onPhoto={addPhoto} onSave={save} onDefer={defer} onComplete={complete} />;

  return <div className="screen tasks-screen">
    <section className="operation-hero task-hero"><span className="operation-hero-icon"><ClipboardList size={25} /></span><p className="eyebrow">KCP Flow · {effectiveRoleSet.name}</p><h1>My Actions</h1><p>{effectiveRoleSet.description}</p><button className="location-pill" type="button" onClick={onLocation}><MapPin size={16} /><span>{location?.displayName || 'Choose a location'}</span><ChevronRight size={15} /></button></section>
    {error && <div className="message message-error operation-message" role="alert">{error}</div>}{notice && <div className="message message-success operation-message">{notice}</div>}
    {!connected && <div className="dashboard-stale">Offline · last saved KCP Flow snapshot is read-only</div>}
    <div className="task-buckets flow-statuses">{ACTION_STATUSES.map((item) => <button type="button" className={`${status === item ? 'is-active' : ''} ${item === 'waiting' ? 'is-danger' : ''}`} key={item} onClick={() => setStatus(item)}><strong>{counts[item] || 0}</strong><span>{actionStatusLabel(item)}</span></button>)}</div>
    <section className="operation-section"><div className="section-title"><div><p className="eyebrow">{actionStatusLabel(status)}</p><h2>Assigned Actions</h2></div><button className="icon-button" type="button" onClick={() => void refresh()} disabled={loading || !connected} aria-label="Refresh Actions"><RefreshCw className={loading ? 'spin' : ''} size={18} /></button></div>
      {loading ? <div className="operation-loading"><LoaderCircle className="spin" /> Loading Actions…</div> : visible.length ? <div className="task-list">{visible.map((action) => <button type="button" key={action.id} onClick={() => void openAction(action)}><span className={`task-list-icon is-${action.priority}`}>{action.status === 'completed' ? <CheckCircle2 size={18} /> : action.isOverdue || action.escalation?.isEscalated ? <AlertTriangle size={18} /> : <ClipboardList size={18} />}</span><div><strong>{action.title}</strong><small>{action.location?.name || action.assignment.label} · {formatDate(action.dueAt)}{action.isOverdue ? ' · Overdue' : ''}</small><small>{action.progress.percent}% complete · {action.status === 'in_progress' ? 'Resume' : action.status === 'ready' ? 'Start' : actionStatusLabel(action.status)}</small></div><ChevronRight size={17} /></button>)}</div> : <div className="transfer-empty">No Actions with this status.</div>}
    </section>{busy && <div className="task-loading-overlay"><LoaderCircle className="spin" /></div>}
  </div>;
}

function ActionDetail({ action, progress, connected, recovered, busy, error, notice, roleSet, onBack, onToggle, onNotes, onPhoto, onSave, onDefer, onComplete }: { action: KcpAction; progress: ActionProgress; connected: boolean; recovered: boolean; busy: boolean; error: string; notice: string; roleSet: RoleSet; onBack: () => void; onToggle: (id: string) => void; onNotes: (value: string) => void; onPhoto: (file?: File) => Promise<void>; onSave: () => Promise<void>; onDefer: () => Promise<void>; onComplete: () => Promise<void> }) {
  return <div className="screen tasks-screen"><header className="count-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to Actions"><ArrowLeft size={19} /></button><div><p className="eyebrow">KCP Flow Action</p><h1>{action.title}</h1></div><span className={`task-priority is-${action.priority}`}>{action.priority}</span></header>
    {error && <div className="message message-error operation-message" role="alert">{error}</div>}{notice && <div className="message message-success operation-message">{notice}</div>}
    {!connected && <div className="offline-operation"><CloudOff size={19} /><div><strong>Secure offline checklist</strong><p>Checklist-only completion can queue safely. Photos and stock-changing operations still require KCP.</p></div></div>}{recovered && <div className="task-recovered"><ShieldCheck size={18} /> Secure interruption recovery active</div>}
    <section className="task-detail-card"><p>{action.description || 'Complete the checklist below.'}</p><div><span>Status</span><strong>{actionStatusLabel(action.status)}</strong></div><div><span>Due</span><strong>{formatDate(action.dueAt)}</strong></div><div><span>Assigned to</span><strong>{action.assignment.label}</strong></div>{action.location && <div><span>Location</span><strong>{action.location.name}</strong></div>}<div><span>Action type</span><strong>{human(action.actionType)}</strong></div>{action.financialImpact && canSeeFinancialImpact(roleSet, action.financialImpact.amount) && <div><span>Financial impact</span><strong>{money(action.financialImpact.amount, action.financialImpact.currency)}</strong></div>}{action.escalation?.isEscalated && <div><span>Escalation</span><strong>{action.escalation.reason || 'Manager attention required'}</strong></div>}</section>
    <section className="operation-section"><div className="section-title"><div><p className="eyebrow">Completion evidence</p><h2>{progress.steps.filter((step) => step.completed).length} of {progress.steps.length} complete</h2></div><ClipboardList size={20} /></div><div className="task-checklist">{action.steps.map((step) => { const checked = progress.steps.find((item) => item.id === step.id)?.completed || false; return <button type="button" key={step.id} className={checked ? 'is-complete' : ''} onClick={() => onToggle(step.id)}><span>{checked && <Check size={17} />}</span><strong>{step.label}</strong>{step.required && <small>Required</small>}</button>; })}</div><label className="po-field"><span>Notes</span><textarea maxLength={2000} value={progress.notes} onChange={(event) => onNotes(event.target.value)} placeholder="Optional notes for the manager" /></label><label className="task-photo"><Camera size={19} /><span>Add photo evidence</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={!connected} onChange={(event) => { void onPhoto(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>{!!progress.evidence?.length && <div className="task-evidence-count">{progress.evidence.length} new photo{progress.evidence.length === 1 ? '' : 's'} ready</div>}</section>
    <div className={`task-actions${roleSet.canDefer ? ' has-defer' : ''}`}><button className="button button-quiet" type="button" onClick={() => void onSave()} disabled={busy || !connected}><Save size={17} /> Save</button>{roleSet.canDefer && <button className="button button-quiet" type="button" onClick={() => void onDefer()} disabled={busy || !connected}>Defer</button>}<button className="button button-primary" type="button" onClick={() => void onComplete()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />} {connected ? 'Complete Action' : 'Queue completion'}</button></div>
  </div>;
}

function ActionHistory({ action, history, connected, onBack }: { action: KcpAction; history: ActionActivity[]; connected: boolean; onBack: () => void }) {
  return <div className="screen tasks-screen"><header className="count-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to Actions"><ArrowLeft size={19} /></button><div><p className="eyebrow">Action activity</p><h1>{action.title}</h1></div><History size={20} /></header>{!connected && <div className="dashboard-stale">Offline snapshot · activity may be incomplete</div>}<section className="operation-section"><div className="task-history">{history.length ? history.map((item) => <article key={item.id}><span><CheckCircle2 size={17} /></span><div><strong>{human(item.eventType)}</strong><small>{item.actorName || 'KCP user'} · {formatDate(item.occurredAt)}</small>{item.detail && <p>{item.detail}</p>}</div></article>) : <div className="transfer-empty">No detailed activity is cached for this Action.</div>}</div></section></div>;
}

export const TasksScreen = KcpFlowScreen;
function fromAction(action: KcpAction): ActionProgress { return { revision: action.revision, notes: action.notes || '', steps: action.steps.map(({ id, completed, note }) => ({ id, completed, note })), evidence: [] }; }
function readFile(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
function message(cause: unknown, fallback: string) { return cause instanceof Error && cause.message ? cause.message : fallback; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date); }
function human(value: string) { return value.replace(/^(task|action)_/, '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function money(value: number, currency: string) { return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR' }).format(value); }
