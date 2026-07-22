import type { AccessSnapshot, AppRoute, KcpLocation } from '../../types/kcp';
import type { ActionPriority, KcpAction } from '../flow/actionModel';
import { rankActions } from '../today/actionPriority';

export type FinancialVisibility = 'none' | 'material_only' | 'full';
export type RoleSetAssignmentRule = 'assigned_only' | 'user_or_role_set' | 'location_operations';
export type RoleSetEscalationRule = { afterMinutes: number; minimumPriority: ActionPriority; financialThreshold?: number | null };

export type RoleSet = {
  id: string;
  name: string;
  description: string;
  preferredActionTypes: string[];
  priorityOrder: ActionPriority[];
  defaultShortcuts: Array<Exclude<AppRoute, 'home' | 'more'>>;
  financialVisibility: FinancialVisibility;
  locationIds: string[];
  assignmentRule: RoleSetAssignmentRule;
  canReassign: boolean;
  canDefer: boolean;
  escalation: RoleSetEscalationRule;
  active: boolean;
  system: boolean;
};

const defaults: RoleSet[] = [
  set('team-member', 'Team Member', 'One assigned operational Action at a time.', ['routine_checklist'], ['tasks'], 'none', 'assigned_only', false, false, 120, 'high'),
  set('stock-controller', 'Stock Controller', 'Counts, transfers, receiving, recounts and catalogue exceptions.', ['stock_count', 'recount', 'transfer', 'receiving', 'barcode_exception', 'catalogue_exception'], ['tasks', 'stock-takes', 'transfers'], 'material_only', 'location_operations', true, true, 60, 'high'),
  set('production-team', 'Production Team', 'Manufacturing requirements, shortages, yield and wastage.', ['manufacturing', 'ingredient_shortage', 'yield_exception', 'manufacturing_wastage'], ['tasks', 'manufacturing', 'wastage'], 'material_only', 'user_or_role_set', false, true, 45, 'high'),
  set('buyer-receiver', 'Buyer / Receiver', 'Deliveries, purchase orders, discrepancies and supplier Actions.', ['expected_delivery', 'purchase_order', 'receiving', 'receiving_discrepancy', 'low_stock', 'supplier'], ['tasks', 'receiving', 'purchase-orders'], 'material_only', 'location_operations', true, true, 45, 'high'),
  set('kitchen-store-manager', 'Kitchen or Store Manager', 'Routines, approvals, staff progress and stockout risks.', ['opening_routine', 'closing_routine', 'wastage_exception', 'approval', 'staff_progress', 'stockout_risk'], ['tasks', 'approvals', 'low-stock'], 'material_only', 'location_operations', true, true, 30, 'normal'),
  set('owner-area-manager', 'Owner / Area Manager', 'Cross-location risk, approvals, overdue operations and financial impact.', ['material_exception', 'cross_location_risk', 'approval', 'overdue_operation', 'financial_impact', 'configuration'], ['tasks', 'approvals', 'low-stock'], 'full', 'location_operations', true, true, 15, 'normal'),
  set('operations-supervisor', 'Operations Supervisor', 'Daily operational exceptions and team throughput.', ['routine_checklist', 'overdue_operation', 'staff_progress'], ['tasks', 'approvals', 'stock-takes'], 'material_only', 'location_operations', true, true, 30, 'high'),
  set('inventory-auditor', 'Inventory Auditor', 'Counts, recounts, variances and evidence review.', ['stock_count', 'recount', 'variance_exception', 'catalogue_exception'], ['tasks', 'stock-takes', 'scan'], 'material_only', 'assigned_only', false, true, 60, 'high'),
  set('finance-reviewer', 'Finance Reviewer', 'Material financial exceptions and approval evidence.', ['financial_impact', 'approval', 'receiving_discrepancy', 'wastage_exception'], ['tasks', 'approvals', 'purchase-orders'], 'full', 'assigned_only', false, true, 30, 'normal'),
  set('catalogue-admin', 'Catalogue Administrator', 'Barcode, UOM and catalogue data exceptions.', ['barcode_exception', 'catalogue_exception', 'uom_exception'], ['tasks', 'scan', 'stock-takes'], 'none', 'assigned_only', true, true, 120, 'high')
];

function set(id: string, name: string, description: string, types: string[], shortcuts: RoleSet['defaultShortcuts'], financial: FinancialVisibility, assignmentRule: RoleSetAssignmentRule, canReassign: boolean, canDefer: boolean, afterMinutes: number, minimumPriority: ActionPriority): RoleSet {
  return { id, name, description, preferredActionTypes: types, priorityOrder: ['urgent', 'high', 'normal', 'low'], defaultShortcuts: shortcuts, financialVisibility: financial, locationIds: ['all'], assignmentRule, canReassign, canDefer, escalation: { afterMinutes, minimumPriority, financialThreshold: financial === 'none' ? null : 500 }, active: true, system: true };
}

export const BUILT_IN_ROLE_SETS = defaults;

export function resolveRoleSet(value: unknown, access: AccessSnapshot): RoleSet {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const requested = String(item.id || item.roleSetId || '').trim();
  const fallbackId = fallbackRoleSetId(access.currentRole);
  const base = defaults.find((entry) => entry.id === requested) || defaults.find((entry) => entry.id === fallbackId) || defaults[0];
  const shortcuts = stringArray(item.defaultShortcuts).filter(isShortcut) as RoleSet['defaultShortcuts'];
  const priority = stringArray(item.priorityOrder).filter(isPriority) as ActionPriority[];
  const financial = String(item.financialVisibility || base.financialVisibility);
  const assignment = String(item.assignmentRule || base.assignmentRule);
  return {
    ...base,
    id: requested || base.id,
    name: String(item.name || base.name),
    description: String(item.description || base.description),
    preferredActionTypes: stringArray(item.preferredActionTypes).length ? stringArray(item.preferredActionTypes) : base.preferredActionTypes,
    priorityOrder: priority.length ? priority : base.priorityOrder,
    defaultShortcuts: shortcuts.length ? shortcuts : base.defaultShortcuts,
    financialVisibility: ['none', 'material_only', 'full'].includes(financial) ? financial as FinancialVisibility : base.financialVisibility,
    locationIds: stringArray(item.locationIds).length ? stringArray(item.locationIds) : base.locationIds,
    assignmentRule: ['assigned_only', 'user_or_role_set', 'location_operations'].includes(assignment) ? assignment as RoleSetAssignmentRule : base.assignmentRule,
    canReassign: item.canReassign === undefined ? base.canReassign : item.canReassign === true,
    canDefer: item.canDefer === undefined ? base.canDefer : item.canDefer === true,
    escalation: normalizeEscalation(item.escalation, base.escalation),
    active: item.active === undefined ? true : item.active === true,
    system: item.system === undefined ? base.system : item.system === true
  };
}

export function filterRoleSetLocations(locations: KcpLocation[], roleSet: RoleSet) {
  if (!roleSet.locationIds.length || roleSet.locationIds.includes('all')) return locations;
  const allowed = new Set(roleSet.locationIds.map(key));
  return locations.filter((location) => [location.id, location.locationId, location.name, location.displayName].some((value) => allowed.has(key(value))));
}

export function sortActionsForRoleSet(actions: KcpAction[], roleSet: RoleSet) {
  return rankActions(actions, roleSet);
}

export function canSeeFinancialImpact(roleSet: RoleSet, amount?: number | null) {
  if (roleSet.financialVisibility === 'full') return true;
  return roleSet.financialVisibility === 'material_only' && Number(amount || 0) >= Number(roleSet.escalation.financialThreshold || 0);
}

// Operational money on working screens (unit costs, order/GRV totals, wastage and
// variance values). Only full financial visibility (owners, area managers and
// finance) sees it; material_only line roles such as stock controllers and buyers,
// and none roles, never do. Kept as a plain visibility check so a screen only needs
// the financialVisibility value, not the whole role set.
export function canSeeOperationalValues(financialVisibility: FinancialVisibility) {
  return financialVisibility === 'full';
}

function fallbackRoleSetId(role: string) {
  if (['owner', 'admin', 'superuser', 'super-user'].includes(role)) return 'owner-area-manager';
  if (['manager'].includes(role)) return 'kitchen-store-manager';
  if (['storeman'].includes(role)) return 'buyer-receiver';
  if (['prep'].includes(role)) return 'production-team';
  if (['stocktaker', 'stocktracker', 'transfer-agent'].includes(role)) return 'stock-controller';
  return 'team-member';
}
function normalizeEscalation(value: unknown, fallback: RoleSetEscalationRule): RoleSetEscalationRule { const item = value && typeof value === 'object' ? value as Record<string, unknown> : {}; const minimum = String(item.minimumPriority || fallback.minimumPriority); return { afterMinutes: finite(item.afterMinutes, fallback.afterMinutes), minimumPriority: isPriority(minimum) ? minimum : fallback.minimumPriority, financialThreshold: item.financialThreshold == null ? fallback.financialThreshold : finite(item.financialThreshold, 0) }; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.map((entry) => String(entry || '').trim()).filter(Boolean) : []; }
function isPriority(value: string): value is ActionPriority { return ['low', 'normal', 'high', 'urgent'].includes(value); }
function isShortcut(value: string): value is RoleSet['defaultShortcuts'][number] { return !['home', 'insights', 'more'].includes(value) && ['tasks', 'approvals', 'low-stock', 'stock-takes', 'wastage', 'scan', 'transfers', 'manufacturing', 'receiving', 'purchase-orders'].includes(value); }
function finite(value: unknown, fallback: number) { const result = Number(value); return Number.isFinite(result) && result >= 0 ? result : fallback; }
function key(value: unknown) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
