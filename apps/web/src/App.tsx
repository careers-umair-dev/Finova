import { Route, Routes } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { RequireAuth } from '@/lib/auth';
import { Forgot, Login, Register, Reset, VerifyEmail } from '@/pages/Auth';
import Contacts from '@/pages/Contacts';
import Dashboard from '@/pages/Dashboard';
import Documents from '@/pages/Documents';
import History from '@/pages/History';
import NotFound from '@/pages/NotFound';
import Notifications from '@/pages/Notifications';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Wallets from '@/pages/Wallets';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<Forgot />} />
      <Route path="/reset-password" element={<Reset />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="documents" element={<Documents />} />
        <Route path="history" element={<History />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="wallets" element={<Wallets />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
