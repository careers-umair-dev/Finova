import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';
import { ErrorState, Field, Input } from './ui';
import { ApiError } from '@/lib/api';
import { ToastProvider, useToast } from '@/lib/toast';

describe('Field accessibility', () => {
  it('links the error to the control and marks it invalid', () => {
    render(<Field label="Email" error="Enter a valid email"><Input /></Field>);
    const input = screen.getByRole('textbox', { name: /email/i });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
  });
  it('adds no invalid state when there is no error', () => {
    render(<Field label="Email"><Input /></Field>);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ErrorState', () => {
  it('shows the API message and offers a retry', () => {
    const retry = vi.fn();
    render(<ErrorState error={new ApiError(500, 'INTERNAL', 'Something went wrong')} onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(retry).toHaveBeenCalledTimes(1);
  });
  it('falls back to a generic message for unknown errors', () => {
    render(<ErrorState error={new Error('boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load this right now.");
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Toasts', () => {
  const Fire = () => { const toast = useToast(); return <><button onClick={() => toast('Saved')}>ok</button><button onClick={() => toast('Nope', 'error')}>bad</button></>; };
  it('announces success politely and errors assertively', () => {
    render(<ToastProvider><Fire /></ToastProvider>);
    fireEvent.click(screen.getByText('ok')); expect(screen.getByRole('status')).toHaveTextContent('Saved');
    fireEvent.click(screen.getByText('bad')); expect(screen.getByRole('alert')).toHaveTextContent('Nope');
  });
});

describe('ErrorBoundary', () => {
  it('replaces a crashed tree with a recoverable fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => { throw new Error('render failure'); };
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    spy.mockRestore();
  });
});
