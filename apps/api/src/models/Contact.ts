import { Schema, model } from 'mongoose';

const contactSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 30 },
    notes: { type: String, maxlength: 500 },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
contactSchema.index({ ownerId: 1, archivedAt: 1, name: 1 });
export const Contact = model('Contact', contactSchema);
