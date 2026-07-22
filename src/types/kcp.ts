export type AuthUser = {
  uid: string;
  id: string;
  email: string;
  displayName: string;
  providerData?: Array<{ providerId: string }>;
};

export type WorkspaceOption = {
  id: string;
  role: string;
  siteName: string;
};

export type UserProfile = {
  uid?: string;
  email?: string;
  name?: string;
  status?: string;
  role?: string;
  siteName?: string;
  workspaceId?: string;
  mustChangePassword?: boolean;
  firstLoginRequired?: boolean;
  requestedWorkspace?: {
    siteName?: string;
    status?: string;
    requestedAt?: string;
  } | null;
  workspaces?: Record<string, {
    role?: string;
    siteName?: string;
  }>;
};

export type KcpSession = {
  token: string;
  expiresAt?: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  deviceId?: string;
  user: AuthUser;
};

export type KcpLocation = {
  id: string;
  locationId: string;
  name: string;
  displayName: string;
  kind?: string;
  active?: boolean;
  isDefault?: boolean;
  [key: string]: unknown;
};

export type RoleDefinition = {
  name: string;
  label: string;
  permissions: string[];
  locations: string[];
};

export type AccessSnapshot = {
  currentRole: string;
  currentIsSuperUser: boolean;
  currentIsKcpSuperUser: boolean;
  permissions: string[];
  allowedSections: string[];
  currentUserLocations: string[];
  accessibleLocations: KcpLocation[];
  roleDefinition: RoleDefinition;
};

export type WorkspaceTheme = {
  id: string;
  backgroundId: string;
  backgroundImage: string;
  backgroundPosition: string;
  customBackground?: string;
  logoDataUrl?: string;
  accent: string;
  accentSecondary: string;
};

export type WorkspaceBootstrap = {
  access: AccessSnapshot;
  locations: KcpLocation[];
  settings: Record<string, unknown>;
  theme: WorkspaceTheme;
  mobileApiVersion: string;
  minSupportedAppVersion: string;
  featureFlags: MobileFeatureFlags;
  roleSet: import('../features/role-sets/roleSetModel').RoleSet;
};

export type MobileFeatureFlags = {
  stockCount: boolean;
  scan: boolean;
  wastage: boolean;
  transfers: boolean;
  manufacturing: boolean;
  receiving: boolean;
  purchaseOrders: boolean;
  tasks: boolean;
  approvals: boolean;
};

export type StockCountLocation = {
  id: string;
  name: string;
  kind?: string;
};

export type StockCountTemplate = {
  id: string;
  name: string;
  version: string;
  scope: string;
  linkedLocations: StockCountLocation[];
};

export type StockCountUom = {
  id: string;
  name: string;
  quantityInBase: number;
  barcode?: string | null;
  sortOrder: number;
};

export type StockCountItem = {
  id: string;
  name: string;
  sku?: string | null;
  category: string;
  baseUom: string;
  barcodes: string[];
  uoms: StockCountUom[];
};

export type StockCountUomEntry = {
  name: string;
  quantity: number;
};

export type StockCountLine = {
  stockItemId: string;
  baseQuantity: number;
  uoms: StockCountUomEntry[];
  note?: string;
  counted: boolean;
};

export type StockCountDraft = {
  id: string;
  templateId: string;
  templateVersion?: string;
  locationId: string;
  lines: StockCountLine[];
  revision: number;
  status: 'server_draft' | 'reconciled' | 'committed';
  savedAt?: string;
  committedAt?: string;
  serverTransactionId?: string;
};

export type StockCountReconciliationLine = {
  stockItemId: string;
  name: string;
  baseUom: string;
  countedBaseQuantity: number;
  expectedQuantity: number;
  varianceQuantity: number;
  unitCost: number;
  varianceValue: number;
  counted: boolean;
  warnings: string[];
};

export type StockCountReconciliation = {
  sessionId: string;
  reconciliationVersion: string;
  reconciledAt: string;
  reconciliationExpiresAt: string;
  currency: string;
  countedItemCount: number;
  uncountedItemCount: number;
  positiveVarianceValue: number;
  negativeVarianceValue: number;
  netVarianceValue: number;
  lines: StockCountReconciliationLine[];
  blockingErrors: string[];
  warnings: string[];
};

export type StockCountHistoryItem = {
  id: string;
  transactionReference?: string;
  templateId?: string;
  templateName?: string;
  locationId: string;
  locationName: string;
  timestamp: string;
  lineCount?: number;
  items?: unknown[];
};

export type AppRoute = 'home' | 'insights' | 'tasks' | 'approvals' | 'low-stock' | 'stock-takes' | 'wastage' | 'scan' | 'transfers' | 'manufacturing' | 'receiving' | 'purchase-orders' | 'more';

export type AuthStage =
  | 'booting'
  | 'signed-out'
  | 'reset-request'
  | 'reset-confirm'
  | 'force-password'
  | 'workspace-select'
  | 'pending'
  | 'ready';

export type AuthState = {
  stage: AuthStage;
  session: KcpSession | null;
  user: AuthUser | null;
  profile: UserProfile | null;
  workspaces: WorkspaceOption[];
  workspace: WorkspaceOption | null;
  workspaceBootstrap: WorkspaceBootstrap | null;
  error: string;
  notice: string;
  busy: boolean;
  resetToken: string;
};
