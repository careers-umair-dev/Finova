import { logger } from '../lib/logger.js';
import { Notification } from '../models/Notification.js';
import { UserPreferences } from '../models/UserPreferences.js';

/** Best-effort: respects the user's in-app preference and never fails the request that triggered it. */
export async function notify(ownerId: string, type: string, title: string, body?: string) {
  try {
    const prefs = await UserPreferences.findOne({ ownerId }).lean();
    if (prefs?.notifications?.inApp === false) return;
    await Notification.create({ ownerId, type, title, body });
  } catch (err) { logger.warn({ err }, 'notification not created'); }
}
