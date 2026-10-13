import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errMsg, useContacts, useCreateTransaction, useWallets } from '@/api/hooks';
import { Field, FormError, Input, Modal, Select } from '@/components/ui';
import { AMOUNT_RE } from '@/lib/money';
import { useToast } from '@/lib/toast';

const schema = z.object({
  walletId: z.string().min(1, 'Choose a wallet'),
  amount: z.string().trim().refine((v) => AMOUNT_RE.test(v) && Number(v) > 0, 'Enter a positive amount with at most 2 decimals'),
  contactId: z.string().optional(),
  description: z.string().trim().max(140).optional(),
  status: z.enum(['completed', 'pending']),
});
type Form = z.infer<typeof schema>;

export default function TransactionDialog({ open, onOpenChange, type, walletId }: { open: boolean; onOpenChange: (o: boolean) => void; type: 'income' | 'expense'; walletId?: string }) {
  const wallets = useWallets().data?.wallets ?? []; const contacts = useContacts({ limit: 100 }).data?.items ?? [];
  const create = useCreateTransaction(); const toast = useToast(); const [err, setErr] = useState<string | null>(null);
  const key = useRef(crypto.randomUUID()); // one idempotency key per dialog session
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { walletId: '', amount: '', contactId: '', description: '', status: 'completed' } });
  useEffect(() => { if (open) { key.current = crypto.randomUUID(); setErr(null); reset({ walletId: walletId ?? wallets[0]?.id ?? '', amount: '', contactId: '', description: '', status: 'completed' }); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const sending = type === 'expense';

  const submit = handleSubmit(async (v) => {
    setErr(null);
    try {
      await create.mutateAsync({ key: key.current, walletId: v.walletId, type, amount: v.amount, status: v.status, description: v.description || undefined, contactId: v.contactId || undefined });
      toast(sending ? 'Send recorded' : 'Receive recorded'); onOpenChange(false);
    } catch (e) { setErr(errMsg(e)); }
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={sending ? 'Send funds' : 'Receive funds'} description="This records an entry in your Finova ledger. No real money moves.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Wallet" error={errors.walletId?.message}>
          <Select {...register('walletId')}>{wallets.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}</Select>
        </Field>
        <Field label="Amount" error={errors.amount?.message}><Input {...register('amount')} inputMode="decimal" placeholder="0.00" autoFocus /></Field>
        <Field label={sending ? 'To (optional)' : 'From (optional)'}>
          <Select {...register('contactId')}><option value="">No counterparty</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Field label="Description (optional)" error={errors.description?.message}><Input {...register('description')} maxLength={140} /></Field>
        <Field label="Status"><Select {...register('status')}><option value="completed">Completed now</option><option value="pending">Pending</option></Select></Field>
        <FormError msg={err} />
        <button className="btn-primary w-full" disabled={isSubmitting || !wallets.length}>{isSubmitting ? 'Saving…' : sending ? 'Record send' : 'Record receive'}</button>
      </form>
    </Modal>
  );
}
