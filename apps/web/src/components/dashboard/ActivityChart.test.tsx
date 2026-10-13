import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Activity } from '@/api/types';
import ActivityChart, { niceStep } from './ActivityChart';

const b = (label: string, net: number, changePct: number | null) => ({ key: label, label, incomeMinor: net, expenseMinor: 0, netMinor: net, changePct });
const data: Activity = { currency: 'USD', period: 'monthly', hasData: true, peakIndex: 1, buckets: [b('JAN', 100000, null), b('FEB', 460000, 17.8), b('MAR', 250000, -45.6)] };
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

describe('ActivityChart', () => {
  it('highlights the peak by default, shows its change tooltip, and lets the user select another bar', () => {
    wrap(<ActivityChart data={data} loading={false} period="monthly" onPeriod={vi.fn()} />);
    expect(screen.getByRole('button', { name: /FEB/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('+17.8%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /MAR/ }));
    expect(screen.getByRole('button', { name: /MAR/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('-45.6%')).toBeInTheDocument();
  });
  it('exposes the data as an accessible table and switches period', () => {
    const onPeriod = vi.fn(); wrap(<ActivityChart data={data} loading={false} period="monthly" onPeriod={onPeriod} />);
    expect(screen.getByRole('table', { name: /net cash flow by month/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annually' })); expect(onPeriod).toHaveBeenCalledWith('annual');
  });
  it('shows an empty state without data', () => {
    wrap(<ActivityChart data={{ ...data, hasData: false, buckets: [], peakIndex: null }} loading={false} period="monthly" onPeriod={vi.fn()} />);
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });
  it('picks round gridline steps', () => { expect(niceStep(920)).toBe(1000); expect(niceStep(2100)).toBe(2500); expect(niceStep(0.2)).toBe(1); });
});
