import { Schema, model } from 'mongoose';
import { CURRENCIES } from '../lib/money.js';

const prefsSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    theme: { type: String, enum: ['light', 'system'], default: 'light' },
    locale: { type: String, default: 'en-US', maxlength: 10 },
    currency: { type: String, enum: CURRENCIES, default: 'USD' },
    notifications: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);
export const UserPreferences = model('UserPreferences', prefsSchema);
