import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errMsg, useCreateWallet, useUpdateWallet } from '@/api/hooks';
import type { Wallet } from '@/api/types';
import { Field, FormError, Input, Modal, Select } from '@/components/ui';
import { AMOUNT_RE, CURRENCIES } from '@/lib/money';
import { useToast } from '@/lib/toast';

const schema = z.object({
  name: z.string().trim().min(1, 'Give the wallet a name').max(60),
  currency: z.enum(CURRENCIES),
  openingBalance: z.string().trim().refine((v) => v === '' || AMOUNT_RE.test(v), 'Use a number with at most 2 decimals, e.g. 250.00'),
});
type Form = z.infer<typeof schema>;

export default function WalletDialog({ open, onOpenChange, wallet }: { open: boolean; onOpenChange: (o: boolean) => void; wallet?: Wallet }) {
  const create = useCreateWallet(); const update = useUpdateWallet(); const toast = useToast(); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: '', currency: 'USD', openingBalance: '' } });
  useEffect(() => {
    if (open) { setErr(null); reset(wallet ? { name: wallet.name, currency: wallet.currency, openingBalance: (wallet.openingBalanceMinor / 100).toFixed(2) } : { name: '', currency: 'USD', openingBalance: '' }); }
  }, [open, wallet, reset]);

  const submit = handleSubmit(async (v) => {
    setErr(null);
    try {
      if (wallet) {
        const patch: Parameters<typeof update.mutateAsync>[0] = { id: wallet.id, name: v.name };
        if (v.currency !== wallet.currency) patch.currency = v.currency;
        if (v.openingBalance && Math.round(Number(v.openingBalance) * 100) !== wallet.openingBalanceMinor) patch.openingBalance = v.openingBalance;
        await update.mutateAsync(patch); toast('Wallet updated');
      } else {
        await create.mutateAsync({ name: v.name, currency: v.currency, openingBalance: v.openingBalance || undefined }); toast('Wallet created');
      }
      onOpenChange(false);
    } catch (e) { setErr(errMsg(e)); }
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={wallet ? 'Edit wallet' : 'Add new wallet'} description="Wallets are ledger accounts inside Finova. They are not linked to a bank.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Wallet name" error={errors.name?.message}><Input {...register('name')} placeholder="Everyday wallet" maxLength={60} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency" error={errors.currency?.message}><Select {...register('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Opening balance" error={errors.openingBalance?.message}><Input {...register('openingBalance')} inputMode="decimal" placeholder="0.00" /></Field>
        </div>
        {wallet && <p className="text-[12.5px] text-mu">Currency and opening balance can only change before the first transaction.</p>}
        <FormError msg={err} />
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : wallet ? 'Save changes' : 'Create wallet'}</button>
      </form>
    </Modal>
  );
}
