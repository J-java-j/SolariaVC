import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { configuredProvider } from './provider.js';
import { invite } from './invitations.js';

const ownerUid = 'solaria-bootstrap-owner';

export async function setupOwner(provider, project, email, approvedEmail) {
  if (project !== provider.projectId) throw new Error('Target project confirmation does not match.');
  email = email?.trim().toLowerCase();
  if (!email || email !== approvedEmail?.trim().toLowerCase() || !provider.accepts(email)) {
    throw new Error('Email does not match the approved Owner for this environment.');
  }
  let owner, page;
  do {
    const batch = await provider.auth.listUsers(1000, page);
    for (const user of batch.users.filter(u => u.customClaims?.role === 'owner')) {
      if (user.email !== email || owner) throw new Error('An Owner already exists. Use the operator transfer procedure.');
      owner = user;
    }
    page = batch.pageToken;
  } while (page);
  if (!owner) {
    // A project-wide fixed UID is a unique reservation even across two operator processes.
    try { owner = await provider.auth.createUser({ uid: ownerUid, email, displayName: 'Team Owner' }); }
    catch (err) {
      if (!['auth/uid-already-exists', 'auth/email-already-exists'].includes(err.code)) throw err;
      owner = await provider.auth.getUser(ownerUid);
    }
    if (owner.email !== email || owner.disabled || (owner.customClaims?.role && owner.customClaims.role !== 'owner')) {
      throw new Error('Owner reservation conflicts with an existing account.');
    }
    await provider.auth.setCustomUserClaims(owner.uid, { ...owner.customClaims, role: 'owner' });
  }
  if (owner.disabled) throw new Error('Owner is inactive. Operator review is required.');
  if (owner.providerData.some(p => p.providerId === 'password')) return 'Owner already configured.';
  await invite(provider, email);
  return 'Owner invitation prepared.';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { project: { type: 'string' }, email: { type: 'string' } } });
  const provider = configuredProvider();
  console.log(await setupOwner(provider, values.project, values.email, process.env.TEAM_OWNER_EMAIL), provider.projectId);
}
