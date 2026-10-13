import { Schema, model } from 'mongoose';

export const DOC_CATEGORIES = ['invoice', 'receipt', 'statement', 'contract', 'other'] as const;
const documentSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: DOC_CATEGORIES, default: 'other' },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    storageKey: { type: String, required: true }, // opaque key in object storage; never a public URL
  },
  { timestamps: true },
);
documentSchema.index({ ownerId: 1, category: 1, createdAt: -1 });
export const DocumentModel = model('Document', documentSchema);
