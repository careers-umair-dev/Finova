import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cloneElement, forwardRef, isValidElement, useId, type HTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

export const Skeleton = ({ className = '' }: { className?: string }) => <div aria-hidden className={cn('animate-pulse rounded-xl bg-neutral-200/70', className)} />;

export function CardHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="text-base font-medium">{title}</h2>{sub && <p className="mt-0.5 text-[12.5px] text-mu">{sub}</p>}</div>
      {action}
    </div>
  );
}

export const Badge = ({ tone = 'green', children }: { tone?: 'green' | 'amber' | 'red' | 'gray'; children: ReactNode }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium',
    tone === 'green' && 'bg-g text-white', tone === 'amber' && 'bg-amber-100 text-amber-800', tone === 'red' && 'bg-red-100 text-red-700', tone === 'gray' && 'bg-neutral-100 text-neutral-600')}>{children}</span>
);

export const Segmented = <V extends string>({ value, onChange, options, label }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[]; label: string }) => (
  <div role="group" aria-label={label} className="flex rounded-full bg-[#f4f4f3]">
    {options.map((o) => (
      <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
        className={cn('rounded-full px-5 py-3 text-[13px] transition', value === o.value ? 'bg-g text-white' : 'text-mu hover:text-ink')}>{o.label}</button>
    ))}
  </div>
);

const palette = ['#e06c8f', '#3b82c4', '#d98a2b', '#5a8f6a', '#8a6fd1', '#c4693b'];
export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
  const color = palette[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
  return <span aria-hidden className="grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>{initials}</span>;
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-g-soft text-g-dark" aria-hidden>✦</div>
      <p className="text-base font-medium">{title}</p>
      {text && <p className="max-w-sm text-mu">{text}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] bg-white p-7 shadow-lift data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-xl font-medium">{title}</Dialog.Title>
              <Dialog.Description className={cn('mt-1 text-mu', !description && 'sr-only')}>{description ?? title}</Dialog.Description>
            </div>
            <Dialog.Close className="ib-sm" aria-label="Close"><X size={16} /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  const id = useId();
  // Links the message to the control (aria-describedby) and flags it invalid, so screen readers announce the error with the field.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-err` : undefined })
    : children;
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-mu">{label}</span>
      {control}
      {error && <span id={`${id}-err`} role="alert" className="mt-1 block text-[13px] text-red-700">{error}</span>}
    </label>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn('input', className)} {...p} />);
Input.displayName = 'Input';
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn('input', className)} {...p} />);
Select.displayName = 'Select';
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof ApiError ? error.message : "We couldn't load this right now.";
  return (
    <div role="alert" className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-50 px-4 py-3 text-red-800">
      <p>{msg}</p>
      {onRetry && <button type="button" className="pill !h-10 !text-[13px]" onClick={onRetry}>Try again</button>}
    </div>
  );
}
export const FormError = ({ msg }: { msg?: string | null }) => (msg ? <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{msg}</p> : null);
export const Row = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('flex items-center', className)} {...p} />;

export const StatusBadge = ({ s }: { s: 'completed' | 'pending' | 'failed' }) => (
  <span className="inline-flex items-center gap-2 text-[13.5px]">
    <span className={cn('h-1.5 w-1.5 rounded-full', s === 'completed' ? 'bg-g/70' : s === 'pending' ? 'bg-amber-500' : 'bg-red-500')} />
    {s === 'completed' ? 'Successful' : s === 'pending' ? 'Pending' : 'Failed'}
  </span>
);
