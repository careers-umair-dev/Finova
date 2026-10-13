import { Download, Eye, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errMsg, useDeleteDocument, useDocuments, useUploadDocument } from '@/api/hooks';
import Pager from '@/components/Pager';
import { EmptyState, ErrorState, FormError, Select } from '@/components/ui';
import { apiUrl } from '@/lib/api';
import { fmtDate } from '@/lib/dates';
import { useToast } from '@/lib/toast';

const CATS = ['invoice', 'receipt', 'statement', 'contract', 'other'] as const;
const OK = ['application/pdf', 'image/png', 'image/jpeg'];
const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export default function Documents() {
  const [q, setQ] = useState(''); const [dq, setDq] = useState(''); const [cat, setCat] = useState(''); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const list = useDocuments({ q: dq || undefined, category: cat || undefined, page, limit: 20 });
  const up = useUploadDocument(); const del = useDeleteDocument(); const toast = useToast();
  const [upCat, setUpCat] = useState<string>('invoice'); const [err, setErr] = useState<string | null>(null); const input = useRef<HTMLInputElement>(null);

  const actions = (d: { id: string; name: string }) => (
    <div className="flex gap-1.5">
      <a className="ib-sm" href={apiUrl(`/documents/${d.id}/download?inline=true`)} target="_blank" rel="noreferrer" aria-label={`Preview ${d.name}`}><Eye size={15} /></a>
      <a className="ib-sm" href={apiUrl(`/documents/${d.id}/download`)} aria-label={`Download ${d.name}`}><Download size={15} /></a>
      <button className="ib-sm" aria-label={`Delete ${d.name}`} onClick={async () => { if (confirm(`Delete “${d.name}”? This can't be undone.`)) { try { await del.mutateAsync(d.id); toast('Document deleted'); } catch (e) { toast(errMsg(e), 'error'); } } }}><Trash2 size={15} /></button>
    </div>
  );
  const onFile = async (file?: File) => {
    if (!file) return; setErr(null);
    if (!OK.includes(file.type)) return setErr('Only PDF, PNG and JPEG files are supported.');
    if (file.size > 5 * 1024 * 1024) return setErr('Files can be at most 5 MB.');
    try { await up.mutateAsync({ file, name: file.name, category: upCat }); toast('Document uploaded'); } catch (e) { setErr(errMsg(e)); }
    if (input.current) input.current.value = '';
  };
  return (
    <section className="card">
      <h1 className="text-2xl font-medium">Documents</h1><p className="text-mu">Invoices, receipts and statements. Only you can open them.</p>
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-3xl bg-canvas p-4">
        <Select aria-label="Category for upload" className="!w-40 !bg-white" value={upCat} onChange={(e) => setUpCat(e.target.value)}>{CATS.map((c) => <option key={c} className="capitalize">{c}</option>)}</Select>
        <input ref={input} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e) => onFile(e.target.files?.[0])} />
        <button className="btn-primary" disabled={up.isPending} onClick={() => input.current?.click()}><Upload size={16} />{up.isPending ? 'Uploading…' : 'Upload document'}</button>
        <span className="text-[13px] text-mu">PDF, PNG or JPEG · up to 5 MB</span>
      </div>
      <div className="mt-3"><FormError msg={err} /></div>
      <div className="mt-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" type="search" placeholder="Search documents…" aria-label="Search documents" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
        <Select aria-label="Filter by category" className="!w-44" value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }}><option value="">All categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</Select>
      </div>
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.data && !list.data.items.length ? <EmptyState title="No documents" text="Upload a PDF or image to keep it with your records." /> : (
        <>
          <ul className="mt-3 divide-y divide-line md:hidden" aria-label="Documents">{list.data?.items.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><b className="block truncate font-medium">{d.name}</b><small className="capitalize text-mu">{d.category} · {size(d.sizeBytes)} · {fmtDate(d.createdAt)}</small></div>
              {actions(d)}
            </li>))}</ul>
          <div className="hidden overflow-x-auto md:block"><table className="mt-3 w-full min-w-[560px] text-left"><thead><tr className="text-[12px] text-mu">{['Name', 'Category', 'Size', 'Added', ''].map((h, i) => <th key={i} scope="col" className="px-2.5 py-2 font-normal">{h || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
            <tbody>{list.data?.items.map((d) => (
              <tr key={d.id} className="hover:bg-canvas"><td className="rounded-l-2xl px-2.5 py-3 font-medium">{d.name}</td><td className="px-2.5 capitalize">{d.category}</td><td className="px-2.5">{size(d.sizeBytes)}</td><td className="px-2.5">{fmtDate(d.createdAt)}</td>
                <td className="rounded-r-2xl px-2.5"><div className="flex justify-end">{actions(d)}</div></td></tr>))}</tbody></table></div>
        </>
      )}
      {list.data && list.data.total > 0 && <Pager page={page} limit={20} total={list.data.total} onPage={setPage} />}
    </section>
  );
}
