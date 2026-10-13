import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errMsg, usePrefs, useRevokeSession, useSavePrefs, useSessions } from '@/api/hooks';
import type { User } from '@/api/types';
import { CardHead, Field, FormError, Input, Select, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtTime } from '@/lib/dates';
import { CURRENCIES } from '@/lib/money';
import { useToast } from '@/lib/toast';

const LOCALES = [['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['de-DE', 'Deutsch'], ['fr-FR', 'Français'], ['ur-PK', 'اردو (پاکستان)']] as const;

function Profile() {
  const { user } = useAuth(); const qc = useQueryClient(); const toast = useToast(); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ name: string }>({ resolver: zodResolver(z.object({ name: z.string().trim().min(1, 'Name is required').max(80) })), defaultValues: { name: user?.name ?? '' } });
  const submit = handleSubmit(async (v) => {
    setErr(null);
    try { const d = await api<{ user: User }>('/me', { method: 'PATCH', json: v }); qc.setQueryData(['me'], d.user); toast('Profile updated'); } catch (e) { setErr(errMsg(e)); }
  });
  return (
    <section className="card"><CardHead title="Profile" sub={user?.email} />
      <form onSubmit={submit} className="mt-4 flex max-w-md flex-col gap-4" noValidate>
        <Field label="Display name" error={errors.name?.message}><Input {...register('name')} maxLength={80} /></Field>
        <FormError msg={err} /><button className="btn-primary self-start" disabled={isSubmitting}>Save</button>
      </form>
    </section>
  );
}

const pwSchema = z.object({ currentPassword: z.string().min(1, 'Required'), newPassword: z.string().min(10, 'Use at least 10 characters').max(72), confirm: z.string() }).refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: "Passwords don't match" });
function Password() {
  const toast = useToast(); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });
  const submit = handleSubmit(async (v) => {
    setErr(null);
    try { await api('/me/password', { json: { currentPassword: v.currentPassword, newPassword: v.newPassword } }); toast('Password changed. Other devices were signed out.'); reset(); } catch (e) { setErr(errMsg(e)); }
  });
  return (
    <section className="card"><CardHead title="Password" sub="Changing it signs out your other devices." />
      <form onSubmit={submit} className="mt-4 flex max-w-md flex-col gap-4" noValidate>
        <Field label="Current password" error={errors.currentPassword?.message}><Input type="password" autoComplete="current-password" {...register('currentPassword')} /></Field>
        <Field label="New password" error={errors.newPassword?.message}><Input type="password" autoComplete="new-password" {...register('newPassword')} /></Field>
        <Field label="Confirm new password" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...register('confirm')} /></Field>
        <FormError msg={err} /><button className="btn-primary self-start" disabled={isSubmitting}>Change password</button>
      </form>
    </section>
  );
}

function Preferences() {
  const q = usePrefs(); const save = useSavePrefs(); const toast = useToast(); const p = q.data;
  const apply = (patch: Parameters<typeof save.mutate>[0]) => save.mutate(patch, { onSuccess: () => toast('Preferences saved'), onError: (e) => toast(errMsg(e), 'error') });
  return (
    <section className="card"><CardHead title="Preferences" sub="Saved automatically." />
      {!p ? <Skeleton className="mt-4 h-32" /> : (
        <div className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2">
          <Field label="Default currency"><Select value={p.currency} onChange={(e) => apply({ currency: e.target.value as typeof p.currency })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Number & date format"><Select value={p.locale} onChange={(e) => apply({ locale: e.target.value })}>{LOCALES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <label className="flex items-center gap-3 sm:col-span-2"><input type="checkbox" className="h-5 w-5 accent-[#07865b]" checked={p.notifications.inApp} onChange={(e) => apply({ notifications: { ...p.notifications, inApp: e.target.checked } })} />In-app notifications</label>
        </div>
      )}
    </section>
  );
}

function Sessions() {
  const q = useSessions(); const revoke = useRevokeSession(); const toast = useToast();
  return (
    <section className="card"><CardHead title="Active sessions" sub="Devices currently signed in to your account." />
      {!q.data ? <Skeleton className="mt-4 h-24" /> : (
        <ul className="mt-3 divide-y divide-line">{q.data.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><p className="max-w-md truncate font-medium">{s.userAgent || 'Unknown device'}{s.current && <span className="ml-2 rounded-full bg-g-soft px-2 py-0.5 text-[11px] text-g-dark">This device</span>}</p><p className="text-[12.5px] text-mu">{s.ip ?? 'Unknown IP'} · last active {fmtDate(s.lastUsedAt)} {fmtTime(s.lastUsedAt)}</p></div>
            {!s.current && <button className="pill !h-10 !text-[13px]" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id, { onSuccess: () => toast('Session revoked'), onError: (e) => toast(errMsg(e), 'error') })}>Revoke</button>}
          </li>))}</ul>
      )}
    </section>
  );
}

export default function Settings() {
  return (
    <div className="space-y-[22px]">
      <h1 className="text-[clamp(28px,3.4vw,40px)] font-medium tracking-tight">Settings</h1>
      <div className="grid gap-[22px] lg:grid-cols-2"><Profile /><Password /></div>
      <Preferences /><Sessions />
    </div>
  );
}
