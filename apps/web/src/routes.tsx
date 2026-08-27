import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { NotFoundPage } from '@/components/layout/NotFoundPage'
import { RouteErrorPage } from '@/components/layout/RouteErrorPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { PublicOnly } from '@/features/auth/PublicOnly'
import { SignupPage } from '@/features/auth/SignupPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { SessionGate } from '@/features/auth/SessionGate'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { ProposalEditorPage } from '@/features/proposals/ProposalEditorPage'
import { ProposalsPage } from '@/features/proposals/ProposalsPage'
import { TimeTrackingPage } from '@/features/time/TimeTrackingPage'

/**
 * One route tree, used by createBrowserRouter in the app and createMemoryRouter
 * in tests, so guard behaviour is exercised exactly as it ships.
 *
 * SessionGate sits at the root — above the public routes as well — so a
 * returning visitor never sees the login screen flash before the session check
 * resolves.
 */
export const routes: RouteObject[] = [
  {
    element: <SessionGate />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignupPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/',
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'clients', element: <ClientsPage /> },
              { path: 'projects', element: <ProjectsPage /> },
              { path: 'proposals', element: <ProposalsPage /> },
              { path: 'proposals/:id', element: <ProposalEditorPage /> },
              { path: 'time', element: <TimeTrackingPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
