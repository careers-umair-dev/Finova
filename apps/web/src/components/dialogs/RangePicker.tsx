import * as Popover from '@radix-ui/react-popover';
import { Calendar, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { customRange, fmtRange, PRESETS, presetRange, type Range } from '@/lib/dates';

export default function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const [open, setOpen] = useState(false); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [err, setErr] = useState('');
  const apply = () => {
    const r = customRange(from, to);
    if (!r) return setErr('Pick a start before the end, within 366 days.');
    setErr(''); onChange(r); setOpen(false);
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="pill" aria-label={`Date range: ${fmtRange(value.from, value.to)}`}>
        <Calendar size={18} /><span className="max-sm:hidden">{fmtRange(value.from, value.to)}</span><ChevronDown size={14} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-[min(320px,92vw)] rounded-3xl bg-white p-3 shadow-lift">
          <ul>
            {PRESETS.map((p) => (
              <li key={p.key}>
                <button onClick={() => { onChange(presetRange(p.key)); setOpen(false); }} className={cn('w-full rounded-2xl px-3 py-2.5 text-left transition hover:bg-canvas', value.key === p.key && 'bg-g-soft font-medium text-g-dark')}>{p.label}</button>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-line px-1 pt-3">
            <p className="mb-2 text-[13px] text-mu">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" aria-label="From date" className="input !h-11 !px-3" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" aria-label="To date" className="input !h-11 !px-3" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
            {err && <p role="alert" className="mt-2 text-[13px] text-red-600">{err}</p>}
            <button onClick={apply} className="btn-primary mt-3 !h-11 w-full">Apply</button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
