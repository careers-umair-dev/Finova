import { Schema, model } from 'mongoose';
import { CURRENCIES } from '../lib/money.js';

const walletSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    currency: { type: String, enum: CURRENCIES, required: true },
    openingBalanceMinor: { type: Number, default: 0, validate: Number.isSafeInteger },
    // Display-only suffix like "9090". It is NOT a card or bank account number.
    displayCode: { type: String, match: /^\d{4}$/ },
    // Bumped inside every ledger transaction so concurrent writers to one wallet serialize (prevents overdraft races).
    ledgerSeq: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
walletSchema.index({ ownerId: 1, archivedAt: 1, createdAt: -1 });
export const Wallet = model('Wallet', walletSchema);
