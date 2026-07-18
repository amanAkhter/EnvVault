// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – Scheduled maintenance
// ─────────────────────────────────────────────────────────────────────────────

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { REGION, db, SYNC_TTL_MS } from './config';

/**
 * cleanupStaleSync — daily sweep. Any active environment membership whose last
 * fetch is older than the TTL is marked `inactive`, forcing the user through a
 * fresh fetch (which re-validates their org + environment status server-side).
 * This is the automated backstop for the "inactive if not synced for 24h" rule.
 */
export const cleanupStaleSync = onSchedule(
  { region: REGION, schedule: '17 * * * *' }, // hourly at :17
  async () => {
    const cutoff = Date.now() - SYNC_TTL_MS;
    const stale = await db
      .collection('environmentMembers')
      .where('status', '==', 'active')
      .where('lastSyncAt', '<', cutoff)
      .limit(500)
      .get();

    if (stale.empty) {
      logger.info('cleanupStaleSync: no stale memberships.');
      return;
    }

    const batch = db.batch();
    for (const doc of stale.docs) {
      batch.update(doc.ref, { status: 'inactive', staleSince: Date.now() });
    }
    await batch.commit();
    logger.info(`cleanupStaleSync: marked ${stale.size} membership(s) inactive.`);
  },
);
