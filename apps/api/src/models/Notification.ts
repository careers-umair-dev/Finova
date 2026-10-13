import { Schema, model } from 'mongoose';

const notificationSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, maxlength: 40 },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, maxlength: 400 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);
notificationSchema.index({ ownerId: 1, readAt: 1, createdAt: -1 });
export const Notification = model('Notification', notificationSchema);
