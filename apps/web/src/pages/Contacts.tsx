import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { errMsg, useContactDetail, useContacts, useMoney, useSaveContact } from '@/api/hooks';
import type { Contact } from '@/api/types';
import Pager from '@/components/Pager';
import { Avatar, Badge, EmptyState, ErrorState, Field, FormError, Input, Modal } from '@/components/ui';
import { useToast } from '@/lib/toast';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.string().trim().max(254).refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email'),
  phone: z.string().trim().refine((v) => v === '' || /^[+\d\s().-]{5,30}$/.test(v), 'Enter a valid phone number'),
  notes: z.string().trim().max(500),
});
type Form = z.infer<typeof schema>;

function ContactDialog({ open, onOpenChange, contact }: { open: boolean; onOpenChange: (o: boolean) => void; contact?: Contact }) {
  const save = useSaveContact(); const toast = useToast(); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
  useEffect(() => { if (open) { setErr(null); reset({ name: contact?.name ?? '', email: contact?.email ?? '', phone: contact?.phone ?? '', notes: contact?.notes ?? '' }); } }, [open, contact, reset]);
  const submit = handleSubmit(async (v) => {
    setErr(null);
    try {
      // On edit, an emptied field is sent as null so the API clears it; on create, empty fields are simply omitted.
      const f = (s: string) => (contact ? (s || null) : (s || undefined));
      await save.mutateAsync({ id: contact?.id, name: v.name, email: f(v.email), phone: f(v.phone), notes: f(v.notes) });
      toast(contact ? 'Contact updated' : 'Contact added'); onOpenChange(false);
    } catch (e) { setErr(errMsg(e)); }
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={contact ? 'Edit contact' : 'Add contact'} description="Contacts can be attached to ledger entries as counterparties.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" error={errors.name?.message}><Input {...register('name')} autoFocus maxLength={80} /></Field>
        <Field label="Email" error={errors.email?.message}><Input {...register('email')} type="email" /></Field>
        <Field label="Phone" error={errors.phone?.message}><Input {...register('phone')} type="tel" /></Field>
        <Field label="Notes" error={errors.notes?.message}><textarea {...register('notes')} rows={3} maxLength={500} className="input !h-auto py-3" /></Field>
        <FormError msg={err} />
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save contact'}</button>
      </form>
    </Modal>
  );
}

function ContactDetail({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (c: Contact) => void }) {
  const q = useContactDetail(id); const save = useSaveContact(); const money = useMoney(); const toast = useToast();
  const c = q.data?.contact;
  return (
    <Modal open={!!id} onOpenChange={(o) => !o && onClose()} title={c?.name ?? 'Contact'} description="Contact details and completed ledger totals.">
      {c && (
        <div className="space-y-4">
          <dl className="divide-y divide-line">{([['Email', c.email], ['Phone', c.phone], ['Notes', c.notes]] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-mu">{k}</dt><dd className="text-right">{v ?? '—'}</dd></div>)}</dl>
          <div><h4 className="mb-2 font-medium">Ledger activity</h4>
            {Object.entries(q.data!.stats.byCurrency).length ? Object.entries(q.data!.stats.byCurrency).map(([cur, s]) => (
              <p key={cur} className="flex justify-between py-1"><span className="text-mu">{cur} · {s.count} entries</span><span className="tabular-nums">in {money(s.incomeMinor, cur)} / out {money(s.expenseMinor, cur)}</span></p>
            )) : <p className="text-mu">No completed entries yet.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/history?contactId=${c.id}`} className="pill !h-11" onClick={onClose}>View transactions</Link>
            <button className="pill !h-11" onClick={() => { onClose(); onEdit(c); }}>Edit</button>
            <button className="pill !h-11" onClick={async () => { try { await save.mutateAsync({ id: c.id, archived: !c.archived }); toast(c.archived ? 'Contact restored' : 'Contact archived'); onClose(); } catch (e) { toast(errMsg(e), 'error'); } }}>{c.archived ? 'Restore' : 'Archive'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Contacts() {
  const [q, setQ] = useState(''); const [dq, setDq] = useState(''); const [archived, setArchived] = useState(false); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const list = useContacts({ q: dq || undefined, includeArchived: archived, page, limit: 20 });
  const [edit, setEdit] = useState<Contact | undefined>(); const [dlg, setDlg] = useState(false); const [view, setView] = useState<string | null>(null);
  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-medium">Contacts</h1><p className="text-mu">People and businesses you send to or receive from.</p></div>
        <button className="btn-primary" onClick={() => { setEdit(undefined); setDlg(true); }}><Plus size={16} />Add contact</button>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <input className="input max-w-sm" type="search" placeholder="Search name or email…" aria-label="Search contacts" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
        <label className="flex items-center gap-2 text-mu"><input type="checkbox" checked={archived} onChange={(e) => { setArchived(e.target.checked); setPage(1); }} />Show archived</label>
      </div>
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.data && !list.data.items.length ? <EmptyState title={dq ? 'No contacts match' : 'No contacts yet'} text="Add a contact to attach it to transactions." action={!dq ? <button className="btn-primary" onClick={() => { setEdit(undefined); setDlg(true); }}>Add contact</button> : undefined} /> : (
        <ul className="mt-4 divide-y divide-line">{list.data?.items.map((c) => (
          <li key={c.id}><button onClick={() => setView(c.id)} className="flex w-full items-center gap-3.5 rounded-2xl px-2 py-3 text-left hover:bg-canvas">
            <Avatar name={c.name} size={40} /><span className="min-w-0 flex-1"><b className="block truncate font-medium">{c.name}</b><small className="text-mu">{c.email ?? c.phone ?? 'No contact details'}</small></span>
            {c.archived && <Badge tone="gray">Archived</Badge>}
          </button></li>))}</ul>
      )}
      {list.data && list.data.total > 0 && <Pager page={page} limit={20} total={list.data.total} onPage={setPage} />}
      <ContactDialog open={dlg} onOpenChange={setDlg} contact={edit} />
      <ContactDetail id={view} onClose={() => setView(null)} onEdit={(c) => { setEdit(c); setDlg(true); }} />
    </section>
  );
}
