import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
// Eager: the landing page is the most common entry point, so it ships in the
// main bundle rather than costing a round-trip on first paint. Every other
// route — including the drag-and-drop scheduler and its dnd/redux
// dependencies — is loaded on demand, so visiting "/" doesn't pull in code
// for pages most visitors never open.
import WelcomePage from './pages/WelcomePage';

const AppShowcasePage = lazy(() => import('./pages/AppShowcasePage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const DirectoryPage = lazy(() => import('./pages/DirectoryPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const VersesPage = lazy(() => import('./pages/VersesPage'));
const VolunteerDashboard = lazy(() => import('./pages/VolunteerDashboard'));
const SessionPage = lazy(() => import('./pages/SessionPage'));
const VolunteerHoursPage = lazy(() => import('./pages/VolunteerHoursPage'));
const ExpertApprovalsPage = lazy(() => import('./pages/ExpertApprovalsPage'));
const RoomsPage = lazy(() => import('./pages/RoomsPage'));
const MetricsPage = lazy(() => import('./pages/MetricsPage'));
const SummitFollowupPage = lazy(() => import('./pages/SummitFollowupPage'));

function LegacyApplicationRedirect() {
  const { role } = useParams();
  return <Navigate to={role ? `/login/${role}` : '/roles'} replace />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/app" element={<AppShowcasePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/login/:role" element={<LoginPage />} />
          <Route path="/apply/:role" element={<LegacyApplicationRedirect />} />
          <Route path="/profile" element={<ProfileSetupPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/profiles" element={<Navigate to="/account" replace />} />
          <Route path="/account" element={<SettingsPage />} />
          <Route path="/account/:section" element={<SettingsPage />} />
          <Route path="/settings" element={<Navigate to="/account" replace />} />
          <Route path="/settings/profile" element={<Navigate to="/account/edit" replace />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
          <Route path="/directory" element={<Navigate to="/home" replace />} />
          <Route path="/volunteer/contacts" element={<DirectoryPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/disciplines" element={<VersesPage />} />
          <Route path="/judging" element={<Navigate to="/schedule" replace />} />
          <Route path="/volunteer" element={<VolunteerDashboard />} />
          <Route path="/volunteer/hours" element={<VolunteerHoursPage />} />
          <Route path="/admin/experts" element={<ExpertApprovalsPage />} />
          <Route path="/admin/rooms" element={<RoomsPage />} />
          <Route path="/admin/metrics" element={<MetricsPage />} />
          <Route path="/follow-up" element={<SummitFollowupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
