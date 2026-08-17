/**
 * Locked v1 product information architecture for Safe-Seed.
 * Roles and routes are the contract between UI and API authorization.
 */

export const ROLES = ['admin', 'operator', 'privacy_reviewer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  operator: 'Operator',
  privacy_reviewer: 'Privacy Reviewer',
};

/** Permissions by role (v1). */
export const ROLE_PERMISSIONS: Record<
  Role,
  {
    manageMembers: boolean;
    manageIntegrations: boolean;
    editSources: boolean;
    editPolicies: boolean;
    runJobs: boolean;
    viewEvidence: boolean;
    downloadEvidence: boolean;
    manageTargets: boolean;
  }
> = {
  admin: {
    manageMembers: true,
    manageIntegrations: true,
    editSources: true,
    editPolicies: true,
    runJobs: true,
    viewEvidence: true,
    downloadEvidence: true,
    manageTargets: true,
  },
  operator: {
    manageMembers: false,
    manageIntegrations: false,
    editSources: true,
    editPolicies: true,
    runJobs: true,
    viewEvidence: true,
    downloadEvidence: true,
    manageTargets: true,
  },
  privacy_reviewer: {
    manageMembers: false,
    manageIntegrations: false,
    editSources: false,
    editPolicies: false,
    runJobs: false,
    viewEvidence: true,
    downloadEvidence: true,
    manageTargets: false,
  },
};

export type NavItem = {
  path: string;
  label: string;
  /** Minimum role that can open the route (admin always can). */
  minRole?: Role;
};

/** Primary nav — matches the planned route map. */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home' },
  { path: '/sources', label: 'Sources' },
  { path: '/policies', label: 'Policies' },
  { path: '/jobs', label: 'Jobs' },
  { path: '/projects', label: 'Projects' },
  { path: '/targets', label: 'Targets' },
  { path: '/settings', label: 'Settings' },
  { path: '/help', label: 'Help' },
];

/** Shown only for platform admins (ADMIN_EMAILS). */
export const PLATFORM_ADMIN_NAV_ITEMS: NavItem[] = [
  { path: '/api-manager', label: 'API Manager' },
];

export const V1_PAGES = [
  'Auth & workspace',
  'Home dashboard',
  'Sources (upload / DB / Salesforce / presets)',
  'Field policies & compliance',
  'Relations (in job wizard)',
  'Seed jobs (list, new wizard, detail)',
  'Results & evidence',
  'Targets (Salesforce sandbox load)',
  'Settings & integrations',
  'Help / onboarding',
] as const;
