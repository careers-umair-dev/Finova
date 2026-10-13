import { Schema, model } from 'mongoose';
import { CURRENCIES } from '../lib/money.js';

export const TX_TYPES = ['income', 'expense'] as const; // Send => expense, Receive => income (internal ledger only)
export const TX_STATUSES = ['completed', 'pending', 'failed'] as const;

const txSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact' },
    type: { type: String, enum: TX_TYPES, required: true },
    amountMinor: { type: Number, required: true, min: 1, validate: Number.isSafeInteger }, // always positive; sign comes from `type`
    currency: { type: String, enum: CURRENCIES, required: true },
    status: { type: String, enum: TX_STATUSES, default: 'completed' },
    description: { type: String, trim: true, maxlength: 140, default: '' },
    category: { type: String, trim: true, maxlength: 40 },
    occurredAt: { type: Date, required: true, default: () => new Date() },
    idempotencyKey: { type: String, maxlength: 100 },
  },
  { timestamps: true },
);
txSchema.index({ ownerId: 1, occurredAt: -1 });
txSchema.index({ ownerId: 1, walletId: 1, occurredAt: -1 });
txSchema.index({ ownerId: 1, status: 1, occurredAt: -1 });
txSchema.index({ ownerId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
txSchema.index({ description: 'text' });
export const Transaction = model('Transaction', txSchema);
