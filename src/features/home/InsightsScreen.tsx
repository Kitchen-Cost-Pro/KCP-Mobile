import { ArrowLeft, BarChart3 } from 'lucide-react';
import type { AccessSnapshot, AppRoute, KcpLocation, MobileFeatureFlags } from '../../types/kcp';
import type { FinancialVisibility } from '../role-sets/roleSetModel';
import { OperationsDashboard } from './OperationsDashboard';

export function InsightsScreen(props: { workspaceId: string; connected: boolean; location: KcpLocation | null; access: AccessSnapshot; featureFlags: MobileFeatureFlags; financialVisibility: FinancialVisibility; onNavigate: (route: AppRoute) => void; onLocation: () => void }) {
  return <div className="screen insights-screen"><header className="count-header"><button className="icon-button" type="button" onClick={() => props.onNavigate('home')} aria-label="Back to Today"><ArrowLeft size={19} /></button><div><p className="eyebrow">KCP Mobile</p><h1>Insights</h1></div><BarChart3 size={20} /></header><OperationsDashboard {...props} /></div>;
}
