import type { Request } from 'express';
import bcrypt from 'bcryptjs';
import { AppError, unauthorized } from '../lib/errors.js';
import { env } from '../config/env.js';
import { sendMail, smtpEnabled } from '../lib/mailer.js';
import { REFRESH_TTL_MS, hashOneTime, hashRefresh, randomToken, signAccess } from '../lib/tokens.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { UserPreferences } from '../models/UserPreferences.js';

const COST = 12;
// Compared against when the email is unknown, so response time doesn't reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('finova-timing-equaliser', COST);

export const publicUser = (u: { id?: string; name: string; email: string; emailVerifiedAt?: Date | null; createdAt?: Date }) => ({
  id: u.id, name: u.name, email: u.email, emailVerified: Boolean(u.emailVerifiedAt), createdAt: u.createdAt,
});

async function createSession(userId: string, req: Request) {
  const refresh = randomToken();
  const s = await Session.create({
    userId, refreshHash: hashRefresh(refresh),
    userAgent: (req.get('user-agent') ?? '').slice(0, 200), ip: req.ip,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { access: signAccess(userId, s.id), refresh };
}

async function sendVerification(user: { id?: string; email: string }) {
  if (!smtpEnabled) return; // verification only when SMTP is configured
  const token = randomToken(32);
  await User.updateOne({ _id: user.id }, { verifyTokenHash: hashOneTime(token) });
  const link = `${env.CLIENT_URL}/verify-email?token=${token}`;
  await sendMail(user.email, 'Verify your Finova email', `Confirm your email: ${link}`, link);
}

export async function register(input: { name: string; email: string; password: string }, req: Request) {
  if (await User.exists({ email: input.email })) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  const user = await User.create({ name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, COST) });
  await UserPreferences.create({ ownerId: user._id });
  await sendVerification(user);
  return { user, ...(await createSession(user.id, req)) };
}

export async function login(email: string, password: string, req: Request) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Incorrect email or password');
  return { user, ...(await createSession(user.id, req)) };
}

/** Rotates the refresh token. Presenting an already-rotated token revokes the whole session (theft signal). */
export async function rotate(refreshToken: string | undefined) {
  if (!refreshToken) throw unauthorized('No refresh token');
  const h = hashRefresh(refreshToken);
  const s = await Session.findOne({ $or: [{ refreshHash: h }, { prevRefreshHash: h }], revokedAt: null, expiresAt: { $gt: new Date() } });
  if (!s) throw unauthorized('Invalid session');
  if (s.refreshHash !== h) { s.revokedAt = new Date(); await s.save(); throw unauthorized('Session revoked'); }
  const next = randomToken();
  s.prevRefreshHash = s.refreshHash; s.refreshHash = hashRefresh(next); s.lastUsedAt = new Date();
  await s.save();
  return { userId: s.userId.toString(), access: signAccess(s.userId.toString(), s.id), refresh: next };
}

export async function revokeByRefresh(refreshToken: string | undefined) {
  if (!refreshToken) return;
  const h = hashRefresh(refreshToken);
  await Session.updateOne({ $or: [{ refreshHash: h }, { prevRefreshHash: h }], revokedAt: null }, { revokedAt: new Date() });
}

export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email });
  if (!user) return; // caller responds identically either way
  const token = randomToken(32);
  await User.updateOne({ _id: user._id }, { resetTokenHash: hashOneTime(token), resetExpiresAt: new Date(Date.now() + 30 * 60 * 1000) });
  const link = `${env.CLIENT_URL}/reset-password?token=${token}`;
  await sendMail(user.email, 'Reset your Finova password', `Reset link (valid 30 minutes): ${link}`, link);
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await User.findOne({ resetTokenHash: hashOneTime(token), resetExpiresAt: { $gt: new Date() } }).select('+resetTokenHash +resetExpiresAt');
  if (!user) throw new AppError(400, 'INVALID_TOKEN', 'Reset link is invalid or has expired');
  user.passwordHash = await bcrypt.hash(newPassword, COST);
  user.resetTokenHash = undefined; user.resetExpiresAt = undefined;
  await user.save();
  await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() }); // sign out everywhere
  return user;
}

export async function verifyEmail(token: string) {
  const user = await User.findOneAndUpdate(
    { verifyTokenHash: hashOneTime(token) },
    { $set: { emailVerifiedAt: new Date() }, $unset: { verifyTokenHash: 1 } },
  );
  if (!user) throw new AppError(400, 'INVALID_TOKEN', 'Verification link is invalid or already used');
  return user;
}

export async function changePassword(userId: string, current: string, next: string, keepSessionId: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) throw new AppError(400, 'WRONG_PASSWORD', 'Current password is incorrect');
  user.passwordHash = await bcrypt.hash(next, COST);
  await user.save();
  await Session.updateMany({ userId, _id: { $ne: keepSessionId }, revokedAt: null }, { revokedAt: new Date() });
}
