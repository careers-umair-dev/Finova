import type { Request } from 'express';
import type { ClientSession } from 'mongoose';
import { ActivityLog } from '../models/ActivityLog.js';

export async function logActivity(
  ownerId: unknown, action: string, req?: Request,
  extra: { entityType?: string; entityId?: string; meta?: Record<string, unknown>; session?: ClientSession } = {},
) {
  const { session, ...rest } = extra;
  await ActivityLog.create(
    [{ ownerId, action, ip: req?.ip, requestId: req ? String(req.id ?? '') : undefined, ...rest }],
    session ? { session } : {},
  );
}
