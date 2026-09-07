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

/**
 * One route tree, used by createBrowserRouter in the app and createMemoryRouter
 * in tests, so guard behaviour is exercised exactly as it ships.
 *
 * SessionGate sits at the root — above the public routes as well — so a
 * returning visitor never sees the login screen flash before the session check
 * resolves.
 *
 * The signed-out screens are imported eagerly, because they are the first thing
 * anyone sees and a spinner before a login form is worse than a slightly larger
 * first chunk. Everything behind the guard is loaded on demand: the router's
 * own `lazy` rather than React.lazy, so the module is fetched while the route
 * is matching instead of after a component has already tried to render.
 *
 * The measurable point of this: the login screen used to carry the proposal
 * editor's drag-and-drop, the timesheet's virtualizer and MobX with it.
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
              {
                path: 'dashboard',
                lazy: async () => {
                  const { DashboardPage } =
                    await import('@/features/dashboard/DashboardPage')
                  return { Component: DashboardPage }
                },
              },
              {
                path: 'clients',
                lazy: async () => {
                  const { ClientsPage } =
                    await import('@/features/clients/ClientsPage')
                  return { Component: ClientsPage }
                },
              },
              {
                path: 'projects',
                lazy: async () => {
                  const { ProjectsPage } =
                    await import('@/features/projects/ProjectsPage')
                  return { Component: ProjectsPage }
                },
              },
              {
                path: 'proposals',
                lazy: async () => {
                  const { ProposalsPage } =
                    await import('@/features/proposals/ProposalsPage')
                  return { Component: ProposalsPage }
                },
              },
              {
                path: 'proposals/:id',
                lazy: async () => {
                  const { ProposalEditorPage } =
                    await import('@/features/proposals/ProposalEditorPage')
                  return { Component: ProposalEditorPage }
                },
              },
              {
                path: 'time',
                lazy: async () => {
                  const { TimeTrackingPage } =
                    await import('@/features/time/TimeTrackingPage')
                  return { Component: TimeTrackingPage }
                },
              },
              {
                path: 'invoices',
                lazy: async () => {
                  const { InvoicesPage } =
                    await import('@/features/invoices/InvoicesPage')
                  return { Component: InvoicesPage }
                },
              },
              {
                path: 'invoices/:id',
                lazy: async () => {
                  const { InvoiceDetailPage } =
                    await import('@/features/invoices/InvoiceDetailPage')
                  return { Component: InvoiceDetailPage }
                },
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
