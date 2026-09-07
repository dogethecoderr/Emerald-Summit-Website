import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const DirectoryPage = lazy(() => import('./pages/DirectoryPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const VolunteerDashboard = lazy(() => import('./pages/VolunteerDashboard'));

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/app" element={<AppShowcasePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/login/:role" element={<LoginPage />} />
          <Route path="/profile" element={<ProfileSetupPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/profiles" element={<Navigate to="/settings" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
          <Route path="/directory" element={<DirectoryPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/judging" element={<Navigate to="/schedule" replace />} />
          <Route path="/volunteer" element={<VolunteerDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
