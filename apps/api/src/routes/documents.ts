import express, { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { AppError, notFound } from '../lib/errors.js';
import { storage } from '../lib/storage.js';
import { escapeRx } from '../lib/text.js';
import { oidStr } from '../lib/zod.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { DOC_CATEGORIES, DocumentModel } from '../models/Document.js';
import { logActivity } from '../services/activity.js';

const r = Router();
r.use(requireAuth); // auth runs BEFORE any body is read
const idParam = z.object({ id: oidStr });
const view = (d: any) => ({ id: String(d._id), name: d.name, category: d.category, mimeType: d.mimeType, sizeBytes: d.sizeBytes, createdAt: d.createdAt }); // never expose storageKey

// Allowed types, verified by magic bytes — the Content-Type header alone is never trusted.
const SIGNATURES: Record<string, number[]> = { 'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff] };
const matches = (mime: string, b: Buffer) => SIGNATURES[mime]!.every((byte, i) => b[i] === byte);
// Upload = raw file bytes as the request body; metadata in the query string (no multipart dependency).
const raw = express.raw({ type: Object.keys(SIGNATURES), limit: '5mb' });

r.post('/', raw, validate({ query: z.object({
  name: z.string().trim().min(1).max(120).transform((s) => s.replace(/[\\/\u0000-\u001f]/g, '_')),
  category: z.enum(DOC_CATEGORIES).default('other'),
}).strict() }), ah(async (req, res) => {
  const mime = (req.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (!SIGNATURES[mime] || !Buffer.isBuffer(req.body) || req.body.length === 0)
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Upload a PDF, PNG or JPEG as the request body');
  if (!matches(mime, req.body)) throw new AppError(415, 'CONTENT_MISMATCH', 'File contents do not match the declared type');
  const q: any = req.query; const ownerId = req.auth!.userId;
  const storageKey = await storage.put(ownerId, req.body);
  try {
    const d = await DocumentModel.create({ ownerId, name: q.name, category: q.category, mimeType: mime, sizeBytes: req.body.length, storageKey });
    await logActivity(ownerId, 'document.upload', req, { entityType: 'document', entityId: d.id, meta: { sizeBytes: req.body.length } });
    res.status(201).json({ data: { document: view(d) } });
  } catch (e) { await storage.remove(storageKey); throw e; } // no orphaned files
}));

r.get('/', validate({ query: z.object({
  q: z.string().trim().max(80).optional(), category: z.enum(DOC_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict() }), ah(async (req, res) => {
  const q: any = req.query; const filter: Record<string, any> = { ownerId: req.auth!.userId };
  if (q.category) filter.category = q.category;
  if (q.q) filter.name = new RegExp(escapeRx(q.q), 'i');
  const [total, rows] = await Promise.all([DocumentModel.countDocuments(filter), DocumentModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean()]);
  res.json({ data: { items: rows.map(view), page: q.page, limit: q.limit, total } });
}));

r.get('/:id/download', validate({ params: idParam, query: z.object({ inline: z.enum(['true', 'false']).default('false') }).strict() }), ah(async (req, res) => {
  const d = await DocumentModel.findOne({ _id: req.params.id, ownerId: req.auth!.userId }).lean();
  if (!d) throw notFound('Document not found');
  let data: Buffer;
  try { data = await storage.get(d.storageKey); } catch { throw notFound('File is not available'); }
  const inline = (req.query as any).inline === 'true';
  res.setHeader('Content-Type', d.mimeType);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(d.name)}`);
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'"); // stored files can never run script in our origin
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(data);
}));

r.patch('/:id', validate({ params: idParam, body: z.object({ name: z.string().trim().min(1).max(120), category: z.enum(DOC_CATEGORIES) }).partial().strict() }),
  ah(async (req, res) => {
    const d = await DocumentModel.findOneAndUpdate({ _id: req.params.id, ownerId: req.auth!.userId }, { $set: req.body }, { new: true }).lean();
    if (!d) throw notFound('Document not found');
    res.json({ data: { document: view(d) } });
  }));

r.delete('/:id', validate({ params: idParam }), ah(async (req, res) => {
  const d = await DocumentModel.findOneAndDelete({ _id: req.params.id, ownerId: req.auth!.userId }).lean();
  if (!d) throw notFound('Document not found');
  await storage.remove(d.storageKey);
  await logActivity(req.auth!.userId, 'document.delete', req, { entityType: 'document', entityId: req.params.id });
  res.json({ data: { ok: true } });
}));

export default r;
