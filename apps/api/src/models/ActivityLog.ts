import { Schema, model } from 'mongoose';

// Append-only audit trail. Never store passwords, tokens, or full request bodies in `meta`.
const activitySchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, maxlength: 60 },
    entityType: { type: String, maxlength: 40 },
    entityId: { type: String, maxlength: 64 },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String, maxlength: 64 },
    requestId: { type: String, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
activitySchema.index({ ownerId: 1, createdAt: -1 });
export const ActivityLog = model('ActivityLog', activitySchema);
