// Fictional preview records only. Nothing in this module calls an API or uses
// browser storage. A fresh mount restores the fixtures.
export type Role = 'staff' | 'board-admin' | 'owner';
export type PreviewView = Role | 'signin';
export type Account = {
  id: string;
  awaitingSetup?: boolean;
  name: string;
  username: string;
  role: Role;
  status: 'active' | 'inactive';
};
export type AccountInput = Pick<Account, 'name' | 'username' | 'role'>;

export const roleLabels: Record<Role, string> = {
  staff: 'Staff',
  'board-admin': 'Board Admin',
  owner: 'Owner',
};

export function parsePreview(value: string | null): PreviewView {
  return value === 'staff' || value === 'board-admin' || value === 'owner' ? value : 'signin';
}

export function createSampleAccounts(): Account[] {
  return [
    { id: 'demo-1', name: 'Avery Morgan', username: 'avery.morgan', role: 'staff', status: 'active' },
    { id: 'demo-2', name: 'Noah Bennett', username: 'noah.bennett', role: 'staff', status: 'active' },
    { id: 'demo-3', name: 'Maya Ellis', username: 'maya.ellis', role: 'staff', status: 'active' },
    { id: 'demo-4', name: 'Theo Brooks', username: 'theo.brooks', role: 'staff', status: 'inactive' },
    { id: 'demo-5', name: 'Riley Chen', username: 'riley.chen', role: 'board-admin', status: 'active' },
    { id: 'demo-6', name: 'Jordan Vale', username: 'jordan.vale', role: 'board-admin', status: 'active' },
    { id: 'demo-7', name: 'Alex Rowan', username: 'alex.rowan', role: 'owner', status: 'active' },
  ];
}

// These rules demonstrate the proposed UI; linked tools retain their own access.
export function canManageAccount(actor: Role, target: Role): boolean {
  return target !== 'owner' && (actor === 'owner' || (actor === 'board-admin' && target === 'staff'));
}

export function saveSampleAccount(accounts: Account[], actor: Role, input: AccountInput, id?: string): Account[] {
  const current = id ? accounts.find((account) => account.id === id) : undefined;
  if ((id && !current) || !canManageAccount(actor, input.role) || (current && !canManageAccount(actor, current.role))) {
    throw new Error('This preview role cannot manage that account.');
  }
  const name = input.name.trim();
  const username = input.username.trim().toLowerCase();
  if (!name || name.length > 120) throw new Error('Enter a name of up to 120 characters.');
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error('Use 3–32 characters for the username: start with a letter, then use letters, numbers, dots, underscores or hyphens.');
  }
  if (accounts.some((account) => account.id !== id && account.username.toLowerCase() === username)) {
    throw new Error('That username is already used by a sample account.');
  }
  if (current) return accounts.map((account) => account.id === id ? { ...account, name, username, role: input.role } : account);
  return [...accounts, { id: `sample-${crypto.randomUUID()}`, name, username, role: input.role, status: 'active' }];
}

export function toggleSampleStatus(accounts: Account[], actor: Role, id: string): Account[] {
  const current = accounts.find((account) => account.id === id);
  if (!current || !canManageAccount(actor, current.role)) throw new Error('This preview role cannot manage that account.');
  return accounts.map((account) => account.id === id
    ? { ...account, status: account.status === 'active' ? 'inactive' : 'active' }
    : account);
}
