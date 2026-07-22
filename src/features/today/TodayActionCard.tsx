import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, MapPin, Play, RotateCw } from 'lucide-react';
import type { KcpAction } from '../flow/actionModel';
import type { RoleSet } from '../role-sets/roleSetModel';
import { canSeeFinancialImpact } from '../role-sets/roleSetModel';
import { actionWhy, dueLabel } from './todayModel';

export function TodayActionCard({ action, roleSet, onPrimary, onSecondary, featured = false }: { action: KcpAction; roleSet: RoleSet; onPrimary: (action: KcpAction) => void; onSecondary?: (action: KcpAction) => void; featured?: boolean }) {
  const waiting = action.status === 'waiting';
  const complete = action.status === 'completed';
  const resume = action.status === 'in_progress';
  return <article className={`today-action-card${featured ? ' is-featured' : ''} is-${action.priority}`}>
    <header><span className="today-action-state">{complete ? <CheckCircle2 size={17} /> : waiting ? <Clock3 size={17} /> : action.isOverdue ? <AlertTriangle size={17} /> : resume ? <RotateCw size={17} /> : <Play size={17} />}</span><div><h3>{action.title}</h3><p><MapPin size={13} />{action.location?.name || action.assignment.label} · {dueLabel(action.dueAt)}</p></div><span className={`today-priority is-${action.priority}`}>{action.priority}</span></header>
    {action.contextLine && <p className="today-context">{action.contextLine}</p>}
    <div className="today-progress"><span><i style={{ width: `${Math.max(0, Math.min(100, action.progress.percent))}%` }} /></span><small>{action.progress.percent}%</small></div>
    <p className="today-why">{actionWhy(action)}</p>
    {action.financialImpact && canSeeFinancialImpact(roleSet, action.financialImpact.amount) && <p className="today-impact">Financial impact <strong>{money(action.financialImpact.amount, action.financialImpact.currency)}</strong></p>}
    {!complete && <footer><button className="button button-primary" type="button" onClick={() => onPrimary(action)} disabled={waiting}>{waiting ? 'Awaiting update' : resume ? 'Resume' : 'Start'} {!waiting && <ArrowRight size={16} />}</button>{onSecondary && <button className="button button-quiet" type="button" onClick={() => onSecondary(action)}>View details</button>}</footer>}
  </article>;
}

function money(value: number, currency: string) { return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR', maximumFractionDigits: 2 }).format(value); }
