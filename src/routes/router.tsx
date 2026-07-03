// ─────────────────────────────────────────────────────────────
// Router – Application route definitions
// ─────────────────────────────────────────────────────────────
import React, { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';

// ── Lazy-loaded pages ────────────────────────────────────────
const LoginPage = React.lazy(() => import('../pages/LoginPage'));
const DashboardLayout = React.lazy(() => import('../components/layout/DashboardLayout'));
const DashboardPage = React.lazy(() => import('../pages/DashboardPage'));
const LeadsPage = React.lazy(() => import('../pages/LeadsPage'));
const LeadDetailPage = React.lazy(() => import('../pages/LeadDetailPage'));
const PipelinePage = React.lazy(() => import('../pages/PipelinePage'));
const TasksPage = React.lazy(() => import('../pages/TasksPage'));
const ReportsPage = React.lazy(() => import('../pages/ReportsPage'));
const SettingsPage = React.lazy(() => import('../pages/SettingsPage'));
const SqlConnectDemoPage = React.lazy(() => import('../pages/SqlConnectDemoPage'));

// ── Suspense fallback ────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-sm text-surface-400">Loading…</p>
      </div>
    </div>
  );
}

// ── Router ───────────────────────────────────────────────────
export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: (
          <Suspense fallback={<PageLoader />}>
            <DashboardLayout />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: 'dashboard',
            element: (
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: 'leads',
            element: (
              <Suspense fallback={<PageLoader />}>
                <LeadsPage />
              </Suspense>
            ),
          },
          {
            path: 'leads/:id',
            element: (
              <Suspense fallback={<PageLoader />}>
                <LeadDetailPage />
              </Suspense>
            ),
          },
          {
            path: 'pipeline',
            element: (
              <Suspense fallback={<PageLoader />}>
                <PipelinePage />
              </Suspense>
            ),
          },
          {
            path: 'tasks',
            element: (
              <Suspense fallback={<PageLoader />}>
                <TasksPage />
              </Suspense>
            ),
          },
          {
            path: 'reports',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ReportsPage />
              </Suspense>
            ),
          },
          {
            path: 'settings',
            element: (
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            ),
          },
          {
            path: 'sql-connect',
            element: (
              <Suspense fallback={<PageLoader />}>
                <SqlConnectDemoPage />
              </Suspense>
            ),
          },
          {
            path: '*',
            element: (
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
]);
