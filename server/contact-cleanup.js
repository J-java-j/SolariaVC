// Operator-invoked, bounded cleanup. No scheduler or cloud resource is created.
import { Firestore } from '@google-cloud/firestore';
import { createFirestoreStore } from './contact-firestore-store.js';

if (!process.argv.includes('--apply')) {
  console.log('No changes made. To delete at most 50 logically expired contact records, set CONTACT_FIRESTORE_PROJECT_ID to the intended project and run npm run contact:cleanup -- --apply.');
  console.log('Uses the configured database/collection and the same shared one-hour cleanup cooldown as the form.');
} else {
  const projectId = process.env.CONTACT_FIRESTORE_PROJECT_ID;
  const databaseId = process.env.CONTACT_FIRESTORE_DATABASE_ID || '(default)';
  const collection = process.env.CONTACT_FIRESTORE_COLLECTION || 'solaria_contact';
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error('Set CONTACT_FIRESTORE_PROJECT_ID explicitly before applying cleanup.');
  }
  if (emulator && (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d{1,5}$/.test(emulator) || !projectId.startsWith('demo-'))) {
    throw new Error('Emulator cleanup requires a loopback endpoint and a demo- project.');
  }
  const firestore = new Firestore({ projectId, databaseId });
  try {
    const result = await createFirestoreStore({ firestore, collection }).cleanupExpired();
    console.log(JSON.stringify({ projectId, databaseId, collection, ...result }));
  } catch {
    console.error('Contact cleanup failed. Check the selected database, service identity permissions, and expiresAt index.');
    process.exitCode = 1;
  } finally {
    await firestore.terminate();
  }
}
