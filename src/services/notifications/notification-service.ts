// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Notification Service
// Thin policy layer over the notification repository. Creation never throws
// into the caller's main flow (best-effort, mirrors the audit service).
// ─────────────────────────────────────────────────────────────────────────────

import { notificationRepository } from '../firestore/notification-repository';
import type { Notification, NotificationType } from '../../types';

export interface NotifyParams {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}

export const notificationService = {
  /** Create a single notification. Best-effort — failures are logged, not thrown. */
  async notify(params: NotifyParams): Promise<void> {
    try {
      const entry: Omit<Notification, 'id'> = {
        organizationId: params.organizationId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
        isRead: false,
        createdAt: Date.now(),
      };
      await notificationRepository.create(entry);
    } catch (error) {
      console.error('[NotificationService] Failed to create notification:', error);
    }
  },

  /** Fan a notification out to multiple recipients. */
  async notifyMany(userIds: string[], params: Omit<NotifyParams, 'userId'>): Promise<void> {
    await Promise.all(userIds.map((userId) => this.notify({ ...params, userId })));
  },
};
