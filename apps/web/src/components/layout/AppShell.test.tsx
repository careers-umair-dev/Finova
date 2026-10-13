import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppShell from './AppShell';

vi.mock('@/api/hooks', () => ({
  useNotifications: () => ({ data: { items: [], unreadCount: 2 } }),
  useMarkRead: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { name: 'Umair Demo', email: 'u@example.com' }, logout: vi.fn() }) }));

const setup = (path = '/reports') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route element={<AppShell />}><Route path="reports" element={<h1>Reports page</h1>} /></Route></Routes>
  </MemoryRouter>,
);
afterEach(() => { Object.defineProperty(navigator, 'onLine', { value: true, configurable: true }); });

describe('AppShell', () => {
  it('has a skip link, a labelled main landmark, and sets the document title', () => {
    setup();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main', { name: 'Reports' })).toHaveAttribute('id', 'main');
    expect(document.title).toBe('Reports · Finova');
  });
  it('provides a mobile bottom nav that marks the current page', () => {
    setup();
    const nav = within(screen.getByRole('navigation', { name: 'Mobile' }));
    for (const name of ['Dashboard', 'Reports', 'History', 'Wallets']) expect(nav.getByRole('link', { name })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Reports' })).toHaveAttribute('aria-current', 'page');
  });
  it('opens the More sheet with the remaining sections and sign out', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const sheet = within(screen.getByRole('dialog', { name: 'More' }));
    for (const name of ['Documents', 'Contacts', 'Notifications', 'Settings']) expect(sheet.getByRole('link', { name })).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
  it('announces unread notifications on the bell', () => {
    setup(); expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
  });
  it('warns when the browser goes offline', () => {
    setup(); expect(screen.queryByText(/you're offline/i)).toBeNull();
    act(() => { Object.defineProperty(navigator, 'onLine', { value: false, configurable: true }); window.dispatchEvent(new Event('offline')); });
    expect(screen.getByRole('status')).toHaveTextContent(/you're offline/i);
  });
});
