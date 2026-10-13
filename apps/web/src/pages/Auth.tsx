import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { errMsg } from '@/api/hooks';
import { Field, FormError, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const email = z.string().trim().toLowerCase().email('Enter a valid email');
const password = z.string().min(10, 'Use at least 10 characters').max(72, 'Use at most 72 characters');

function Shell({ title, sub, children, footer }: { title: string; sub: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="grid w-full max-w-[920px] overflow-hidden rounded-[32px] bg-white shadow-lift md:grid-cols-[1fr_1.1fr]">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-[#0a8f62] to-[#055a3d] p-10 text-white md:flex">
          <div className="flex items-center gap-2.5 text-2xl font-semibold"><svg width="36" height="36" viewBox="0 0 38 38" aria-hidden><rect width="38" height="38" rx="12" fill="#fff" fillOpacity=".15" /><path d="M11 26V12h16M11 19h11" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" fill="none" /></svg>Finova</div>
          <div><p className="text-3xl font-medium leading-snug">Your money picture, in one calm place.</p><p className="mt-3 text-white/90">Track wallets, cash flow and documents. Finova is a ledger: it doesn't connect to banks or move real money.</p></div>
        </div>
        <div className="p-8 sm:p-10">
          <h1 className="text-[28px] font-medium">{title}</h1><p className="mb-6 mt-1 text-mu">{sub}</p>
          {children}
          {footer && <div className="mt-6 text-center text-[13.5px] text-mu">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
const useRedirectIfAuthed = () => { const { user } = useAuth(); const loc = useLocation(); return user ? <Navigate to={(loc.state as { from?: string } | null)?.from ?? '/'} replace /> : null; };

export function Login() {
  const { login } = useAuth(); const navigate = useNavigate(); const loc = useLocation(); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>({ resolver: zodResolver(z.object({ email, password: z.string().min(1, 'Enter your password') })) });
  const redirect = useRedirectIfAuthed(); if (redirect) return redirect;
  const submit = handleSubmit(async (v) => { setErr(null); try { await login(v.email, v.password); navigate((loc.state as { from?: string } | null)?.from ?? '/', { replace: true }); } catch (e) { setErr(errMsg(e)); } });
  return (
    <Shell title="Welcome back" sub="Sign in to your Finova account." footer={<>New here? <Link to="/register" className="text-g">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" autoFocus {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register('password')} /></Field>
        <div className="text-right text-[13px]"><Link to="/forgot-password" className="text-g">Forgot password?</Link></div>
        <FormError msg={err} /><button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register: signUp } = useAuth(); const navigate = useNavigate(); const [err, setErr] = useState<string | null>(null);
  const schema = z.object({ name: z.string().trim().min(1, 'Enter your name').max(80), email, password });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const redirect = useRedirectIfAuthed(); if (redirect) return redirect;
  const submit = handleSubmit(async (v) => { setErr(null); try { await signUp(v.name, v.email, v.password); navigate('/', { replace: true }); } catch (e) { setErr(errMsg(e)); } });
  return (
    <Shell title="Create your account" sub="Start with an empty, private workspace." footer={<>Already registered? <Link to="/login" className="text-g">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" error={errors.name?.message}><Input autoComplete="name" autoFocus {...register('name')} /></Field>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register('password')} /></Field>
        <FormError msg={err} /><button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create account'}</button>
      </form>
    </Shell>
  );
}

export function Forgot() {
  const [sent, setSent] = useState(false); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email })) });
  const submit = handleSubmit(async (v) => { setErr(null); try { await api('/auth/forgot-password', { json: v }); setSent(true); } catch (e) { setErr(errMsg(e)); } });
  return (
    <Shell title="Reset your password" sub="We'll email you a link if the account exists." footer={<Link to="/login" className="text-g">Back to sign in</Link>}>
      {sent ? <p role="status" className="rounded-2xl bg-g-soft p-4 text-g-dark">If that email has an account, a reset link is on its way. It expires in 30 minutes.</p> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" error={errors.email?.message}><Input type="email" autoFocus {...register('email')} /></Field>
          <FormError msg={err} /><button className="btn-primary w-full" disabled={isSubmitting}>Send reset link</button>
        </form>
      )}
    </Shell>
  );
}

export function Reset() {
  const [sp] = useSearchParams(); const token = sp.get('token') ?? ''; const navigate = useNavigate(); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ password: string }>({ resolver: zodResolver(z.object({ password })) });
  const submit = handleSubmit(async (v) => { setErr(null); try { await api('/auth/reset-password', { json: { token, password: v.password } }); navigate('/login', { replace: true }); } catch (e) { setErr(errMsg(e)); } });
  return (
    <Shell title="Choose a new password" sub="You'll be signed out everywhere else." footer={<Link to="/login" className="text-g">Back to sign in</Link>}>
      {!token ? <FormError msg="This reset link is missing its token. Request a new one." /> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="New password" error={errors.password?.message}><Input type="password" autoComplete="new-password" autoFocus {...register('password')} /></Field>
          <FormError msg={err} /><button className="btn-primary w-full" disabled={isSubmitting}>Save password</button>
        </form>
      )}
    </Shell>
  );
}

export function VerifyEmail() {
  const [sp] = useSearchParams(); const token = sp.get('token'); const [state, setState] = useState<'working' | 'ok' | string>('working');
  useEffect(() => { if (!token) return setState('This verification link is missing its token.'); api('/auth/verify-email', { json: { token } }).then(() => setState('ok'), (e) => setState(errMsg(e))); }, [token]);
  return (
    <Shell title="Email verification" sub="" footer={<Link to="/" className="text-g">Continue to Finova</Link>}>
      <p role="status" className={state === 'ok' ? 'rounded-2xl bg-g-soft p-4 text-g-dark' : 'text-mu'}>{state === 'working' ? 'Verifying…' : state === 'ok' ? 'Your email is verified. Thank you!' : state}</p>
    </Shell>
  );
}
