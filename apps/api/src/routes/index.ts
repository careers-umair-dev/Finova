import { Router } from 'express';
import { csrfGuard } from '../middleware/security.js';
import analyticsRoutes from './analytics.js';
import authRoutes from './auth.js';
import contactRoutes from './contacts.js';
import documentRoutes from './documents.js';
import meRoutes from './me.js';
import notificationRoutes from './notifications.js';
import transactionRoutes from './transactions.js';
import walletRoutes from './wallets.js';

const api = Router();
api.use(csrfGuard);
api.use('/auth', authRoutes);
api.use('/me', meRoutes);
api.use('/wallets', walletRoutes);
api.use('/transactions', transactionRoutes);
api.use('/contacts', contactRoutes);
api.use('/documents', documentRoutes);
api.use('/notifications', notificationRoutes);
api.use(analyticsRoutes); // /dashboard/* and /reports/* (each route applies requireAuth itself)
export default api;
