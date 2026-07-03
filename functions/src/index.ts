// ─────────────────────────────────────────────────────────────
// Cloud Functions Entry Point – HT CRM
// ─────────────────────────────────────────────────────────────
// Exports:
//   api               — Express app mounted at /api/** via firebase.json rewrite.
//                       This is the primary endpoint hit by the frontend.
//   shopifyWebhook    — Direct HTTPS function for Shopify webhook delivery.
//   slaChecker        — Scheduled: every 5 min, marks overdue leads.
//   slaWarningChecker — Scheduled: every 5 min, sets warning status at 75%.
// ─────────────────────────────────────────────────────────────
import * as functions from 'firebase-functions';
import { Request, Response } from 'express';
import express = require('express');
import cors from 'cors';
import { leadCaptureHandler } from './api/leadCapture';
import './firebaseAdmin'; // Centralized Firebase Admin SDK Initialization


// ── Express App — mounted as the `api` Cloud Function ─────────
// firebase.json rewrites: /api/** → api (this function)
// Frontend calls: /api/leads/create, /api/leads/status, etc.
const app = express();

// Parse JSON bodies
app.use(express.json());

// Global preflight handler — per-route handlers manage their own full CORS.
// This ensures OPTIONS preflight requests return quickly at the app level.
app.options('*', cors({ origin: true }));

// ── Route: Lead Capture ────────────────────────────────────────
// POST /api/leads/create
app.post('/leads/create', leadCaptureHandler);

// ── Route: Health Check ────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Catch-All 404 ─────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Export the Express app as the `api` function.
// firebase.json rewrite: { "source": "/api/**", "function": "api" }
export const api = functions.https.onRequest(app);

// Re-export other Cloud Functions
export { shopifyWebhook } from './api/webhookReceiver';
export { slaChecker, slaWarningChecker } from './triggers/slaChecker';
