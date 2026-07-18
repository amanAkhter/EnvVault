// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Notification Repository
// Per-user in-app notifications.
// ─────────────────────────────────────────────────────────────────────────────

import { FirestoreRepository } from './base-repository';
import type { Notification } from '../../types';

class NotificationRepository extends FirestoreRepository<Notification> {
  constructor() {
    super('notifications');
  }

  /** A user's notifications, newest first. */
  async getByUser(userId: string, pageSize = 30): Promise<Notification[]> {
    const all = await this.getByField('userId', userId);
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, pageSize);
  }

  /** Count of unread notifications for a user. */
  async getUnreadCount(userId: string): Promise<number> {
    const all = await this.getByField('userId', userId);
    return all.filter((n) => !n.isRead).length;
  }

  async markRead(id: string): Promise<void> {
    await this.update(id, { isRead: true } as Partial<Notification>);
  }

  async markAllRead(userId: string): Promise<void> {
    const all = await this.getByField('userId', userId);
    const unread = all.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    const batch = this.createBatch();
    for (const n of unread) {
      this.addToBatch(batch, n.id, { isRead: true } as Partial<Notification>);
    }
    await batch.commit();
  }
}

export const notificationRepository = new NotificationRepository();
