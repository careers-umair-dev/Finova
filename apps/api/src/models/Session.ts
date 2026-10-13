import { Schema, model } from 'mongoose';

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshHash: { type: String, required: true, index: true },
    prevRefreshHash: { type: String, index: true }, // for refresh-token reuse detection
    userAgent: { type: String, maxlength: 200 },
    ip: { type: String, maxlength: 64 },
    lastUsedAt: { type: Date, default: () => new Date() },
    revokedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL cleanup
export const Session = model('Session', sessionSchema);
