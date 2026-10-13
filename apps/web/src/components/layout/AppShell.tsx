import * as Dialog from '@radix-ui/react-dialog';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import { BarChart3, Bell, FileText, LayoutGrid, ListChecks, LogOut, MoreHorizontal, Search, Settings, Users, Wallet as WalletIcon, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMarkRead, useNotifications } from '@/api/hooks';
import { Modal } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';

type Route = { to: string; label: string; Icon: LucideIcon };
const R: Record<string, Route> = {
  dashboard: { to: '/', label: 'Dashboard', Icon: LayoutGrid }, reports: { to: '/reports', label: 'Reports', Icon: BarChart3 },
  history: { to: '/history', label: 'History', Icon: ListChecks }, wallets: { to: '/wallets', label: 'Wallets', Icon: WalletIcon },
  documents: { to: '/documents', label: 'Documents', Icon: FileText }, contacts: { to: '/contacts', label: 'Contacts', Icon: Users },
  notifications: { to: '/notifications', label: 'Notifications', Icon: Bell }, settings: { to: '/settings', label: 'Settings', Icon: Settings },
};
const TITLES = Object.fromEntries(Object.values(R).map((r) => [r.to, r.label]));
const TOP = [R.dashboard!, R.reports!, R.documents!, R.history!, R.contacts!];
const BOTTOM = [R.dashboard!, R.reports!, R.history!, R.wallets!];
const MORE = [R.documents!, R.contacts!, R.notifications!, R.settings!];

const useOnline = () => useSyncExternalStore(
  (cb) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; },
  () => navigator.onLine, () => true,
);

const Logo = () => (
  <Link to="/" className="flex items-center gap-2.5 text-[26px] font-semibold tracking-tight text-g" aria-label="Finova home">
    <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden><rect width="38" height="38" rx="12" fill="#07865b" /><path d="M11 26V12h16M11 19h11" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" fill="none" /><circle cx="26" cy="26" r="3" fill="#b8dccb" /></svg>
    <span className="max-sm:hidden">Finova</span>
  </Link>
);

function NotificationsMenu() {
  const { data } = useNotifications({ limit: 5 }); const mark = useMarkRead(); const unread = data?.unreadCount ?? 0;
  return (
    <Menu.Root>
      <Menu.Trigger className="ib relative" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
        <Bell size={20} />
        {unread > 0 && <span aria-hidden className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-g px-1 text-[11px] font-medium text-white">{unread > 9 ? '9+' : unread}</span>}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={8} className="z-50 w-[min(340px,92vw)] rounded-3xl bg-white p-2 shadow-lift data-[state=open]:animate-drop-in">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="font-medium">Notifications</span>
            <button className="text-[13px] text-g-dark disabled:text-mu" disabled={!unread} onClick={() => mark.mutate(undefined)}>Mark all read</button>
          </div>
          {data?.items.length ? data.items.map((n) => (
            <Menu.Item key={n.id} onSelect={() => !n.read && mark.mutate(n.id)} className="cursor-pointer rounded-2xl px-3 py-2.5 outline-none data-[highlighted]:bg-canvas">
              <div className="flex items-start gap-2">
                <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-g')} />
                <div><p className="font-medium">{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</p>{n.body && <p className="text-[13px] text-mu">{n.body}</p>}</div>
              </div>
            </Menu.Item>
          )) : <p className="px-3 py-6 text-center text-mu">You're all caught up.</p>}
          <Menu.Item asChild><Link to="/notifications" className="block rounded-2xl px-3 py-2.5 text-center text-g-dark outline-none data-[highlighted]:bg-canvas">View all</Link></Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ProfileMenu() {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  const item = 'cursor-pointer rounded-2xl px-3 py-2.5 outline-none data-[highlighted]:bg-canvas';
  return (
    <Menu.Root>
      <Menu.Trigger aria-label="Profile menu" className="grid h-[50px] w-[50px] place-items-center rounded-full bg-gradient-to-br from-[#0b6b4b] to-[#6fc3a0] font-medium text-white transition active:scale-95">
        {user?.name.charAt(0).toUpperCase()}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={8} className="z-50 w-60 rounded-3xl bg-white p-2 shadow-lift data-[state=open]:animate-drop-in">
          <div className="px-3 py-2"><p className="font-medium">{user?.name}</p><p className="truncate text-[13px] text-mu">{user?.email}</p></div>
          <Menu.Item className={item} onSelect={() => navigate('/settings')}>Settings</Menu.Item>
          <Menu.Item className={item} onSelect={() => logout()}>Sign out</Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate(); const [q, setQ] = useState('');
  const go = (e: FormEvent) => { e.preventDefault(); onOpenChange(false); navigate(`/history${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); setQ(''); };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Search transactions" description="Matches descriptions, categories and counterparty names.">
      <form onSubmit={go} className="flex gap-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. invoice, Acme…" className="input" aria-label="Search query" maxLength={80} />
        <button className="btn-primary">Search</button>
      </form>
    </Modal>
  );
}

/** Active indicator slides between items (shared layout animation). Disabled automatically for reduced-motion users. */
const Pill = ({ id, className }: { id: string; className: string }) => <motion.span layoutId={id} className={className} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />;

const RailLink = ({ r, group }: { r: Route; group: string }) => (
  <NavLink to={r.to} end={r.to === '/'} aria-label={r.label} title={r.label} className={({ isActive }) => cn('relative grid h-14 w-14 shrink-0 place-items-center rounded-full transition-colors', isActive ? 'text-white' : 'text-[#444] hover:bg-[#f1f1f0]')}>
    {({ isActive }) => <>{isActive && <Pill id={`rail-${group}`} className="absolute inset-0 rounded-full bg-g" />}<r.Icon size={20} className="relative" /></>}
  </NavLink>
);
const Group = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn('flex flex-col gap-1.5 rounded-[40px] bg-white p-2 shadow-card', className)}>{children}</div>;

/** Phones and tablets: bottom tab bar + "More" sheet replace both the centre nav and the side rail. */
function MobileNav() {
  const [more, setMore] = useState(false); const { logout } = useAuth(); const { pathname } = useLocation();
  useEffect(() => setMore(false), [pathname]);
  const tab = 'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors';
  return (
    <>
      <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {BOTTOM.map((r) => (
          <NavLink key={r.to} to={r.to} end={r.to === '/'} className={({ isActive }) => cn(tab, isActive ? 'font-medium text-g-dark' : 'text-mu')}>
            {({ isActive }) => <>{isActive && <Pill id="tab-dot" className="absolute top-0 h-[3px] w-8 rounded-full bg-g" />}<r.Icon size={22} aria-hidden />{r.label}</>}
          </NavLink>
        ))}
        <button className={cn(tab, 'text-mu')} onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more}><MoreHorizontal size={22} aria-hidden />More</button>
      </nav>
      <Dialog.Root open={more} onOpenChange={setMore}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lift data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in">
            <div className="mb-3 flex items-center justify-between"><Dialog.Title className="text-lg font-medium">More</Dialog.Title><Dialog.Close className="ib-sm" aria-label="Close"><X size={16} /></Dialog.Close></div>
            <Dialog.Description className="sr-only">Other sections of Finova</Dialog.Description>
            <ul className="grid grid-cols-2 gap-2">
              {MORE.map((r) => (
                <li key={r.to}><Link to={r.to} className="flex min-h-14 items-center gap-3 rounded-2xl bg-canvas px-4 font-medium active:scale-[.98]"><r.Icon size={20} aria-hidden />{r.label}</Link></li>
              ))}
              <li className="col-span-2"><button onClick={() => logout()} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-canvas px-4 font-medium"><LogOut size={20} aria-hidden />Sign out</button></li>
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

export default function AppShell() {
  const [searching, setSearching] = useState(false); const { logout } = useAuth(); const online = useOnline();
  const { pathname } = useLocation(); const main = useRef<HTMLElement>(null); const first = useRef(true);
  const title = TITLES[pathname] ?? 'Finova';

  // On navigation: update the tab title and move focus to the content, so keyboard and screen-reader users land in the new page.
  useEffect(() => {
    document.title = `${title} · Finova`;
    if (first.current) { first.current = false; return; }
    main.current?.focus({ preventScroll: true });
    window.scrollTo?.({ top: 0 });
  }, [pathname, title]);

  return (
    <div className="p-[clamp(8px,3vw,40px)] pb-24 lg:pb-[clamp(8px,3vw,40px)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:shadow-lift">Skip to content</a>
      <div className="mx-auto max-w-[1480px] rounded-[26px] bg-canvas p-3 pb-7 sm:p-6">
        <header aria-label="Site header" className="flex min-h-[90px] flex-wrap items-center justify-between gap-3 rounded-[40px] bg-white px-4 py-3 shadow-card sm:px-6">
          <Logo />
          <nav aria-label="Primary" className="hidden gap-1 rounded-full bg-canvas p-1.5 lg:flex">
            {TOP.map((r) => (
              <NavLink key={r.to} to={r.to} end={r.to === '/'} className={({ isActive }) => cn('relative whitespace-nowrap rounded-full px-5 py-3 text-[15px] transition-colors', isActive ? 'font-medium text-ink' : 'text-[#5f5f5f] hover:text-ink')}>
                {({ isActive }) => <>{isActive && <Pill id="top-pill" className="absolute inset-0 rounded-full bg-white shadow-sm" />}<span className="relative">{r.label}</span></>}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <button className="ib" aria-label="Search" onClick={() => setSearching(true)}><Search size={20} /></button>
            <NotificationsMenu />
            <ProfileMenu />
          </div>
        </header>

        <div className="mt-6 grid gap-[22px] lg:grid-cols-[96px_minmax(0,1fr)]">
          <aside aria-label="Sections" className="hidden flex-col gap-4 lg:flex">
            <Group>{[R.dashboard!, R.reports!, R.wallets!, R.history!].map((r) => <RailLink key={r.to} r={r} group="a" />)}</Group>
            <Group>{[R.documents!, R.contacts!, R.notifications!].map((r) => <RailLink key={r.to} r={r} group="b" />)}</Group>
            <Group className="mt-auto">
              <RailLink r={R.settings!} group="c" />
              <button className="grid h-14 w-14 place-items-center rounded-full text-[#444] transition-colors hover:bg-[#f1f1f0]" aria-label="Sign out" title="Sign out" onClick={() => logout()}><LogOut size={20} /></button>
            </Group>
          </aside>
          <main id="main" ref={main} tabIndex={-1} aria-label={title} className="min-w-0 outline-none">
            {!online && <div role="status" className="mb-4 rounded-2xl bg-amber-100 px-4 py-3 text-amber-900">You're offline. Changes can't be saved until you reconnect.</div>}
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}><Outlet /></motion.div>
          </main>
        </div>
      </div>
      <MobileNav />
      <SearchDialog open={searching} onOpenChange={setSearching} />
    </div>
  );
}
