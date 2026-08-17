import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { TourProvider } from './components/Tour';
import { useAuth } from './lib/auth';
import { HomePage } from './pages/HomePage';
import { LoginPage, SignupPage } from './pages/LoginPage';
import { RequestApiKeyPage } from './pages/RequestApiKeyPage';
import { SourcesPage, SourceNewPage, SourceDetailPage } from './pages/SourcesPage';
import { PoliciesPage, PolicyNewPage, PolicyDetailPage } from './pages/PoliciesPage';
import { JobsPage, JobNewPage } from './pages/JobsPage';
import { JobDetailRoute, JobReportRoute } from './pages/JobDetailReport';
import { ApproveApiKeyPage } from './pages/ApproveApiKeyPage';
import { ApiManagerPage } from './pages/ApiManagerPage';
import {
  TargetsPage,
  TargetDetailPage,
  SettingsPage,
  IntegrationsPage,
  HelpPage,
} from './pages/TargetsSettingsHelp';
import { ProjectsPage } from './pages/ProjectsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted" style={{ padding: 40 }}>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <TourProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/request-api-key" element={<RequestApiKeyPage />} />
      <Route path="/admin/approve/:reqId" element={<ApproveApiKeyPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="sources/new" element={<SourceNewPage />} />
        <Route path="sources/:id" element={<SourceDetailPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="policies/new" element={<PolicyNewPage />} />
        <Route path="policies/:id" element={<PolicyDetailPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/new" element={<JobNewPage />} />
        <Route path="jobs/:id" element={<JobDetailRoute />} />
        <Route path="jobs/:id/report" element={<JobReportRoute />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="targets" element={<TargetsPage />} />
        <Route path="targets/:orgId" element={<TargetDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/integrations" element={<IntegrationsPage />} />
        <Route path="settings/members" element={<SettingsPage />} />
        <Route path="api-manager" element={<ApiManagerPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="workspaces" element={<Navigate to="/settings" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </TourProvider>
  );
}
