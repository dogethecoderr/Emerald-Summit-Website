import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import GetTheAppBanner from './components/GetTheAppBanner';
import PageRouteBoundary from './components/PageRouteBoundary';
import Summit27IntroHost from './components/Summit27Intro';
import { lazyPage } from './lib/staleBuild';
// Eager: the landing page is the most common entry point, so it ships in the
// main bundle rather than costing a round-trip on first paint. Every other
// route — including the drag-and-drop scheduler and its dnd/redux
// dependencies — is loaded on demand, so visiting "/" doesn't pull in code
// for pages most visitors never open.
import WelcomePage from './pages/WelcomePage';

const HomePage = lazyPage(() => import('./pages/HomePage'));
const LoginPage = lazyPage(() => import('./pages/LoginPage'));
const RolesPage = lazyPage(() => import('./pages/RolesPage'));
const ProfileSetupPage = lazyPage(() => import('./pages/ProfileSetupPage'));
const SchedulePage = lazyPage(() => import('./pages/SchedulePage'));
const AnnouncementsPage = lazyPage(() => import('./pages/AnnouncementsPage'));
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'));
const DirectoryPage = lazyPage(() => import('./pages/DirectoryPage'));
const ResourcesPage = lazyPage(() => import('./pages/ResourcesPage'));
const VersesPage = lazyPage(() => import('./pages/VersesPage'));
const VolunteerDashboard = lazyPage(() => import('./pages/VolunteerDashboard'));
const SessionPage = lazyPage(() => import('./pages/SessionPage'));
const TeamTrackPage = lazyPage(() => import('./pages/TeamTrackPage'));
const VolunteerHoursPage = lazyPage(() => import('./pages/VolunteerHoursPage'));
const ExpertApprovalsPage = lazyPage(() => import('./pages/ExpertApprovalsPage'));
const BeAMentorPage = lazyPage(() => import('./pages/BeAMentorPage'));
const RoomsPage = lazyPage(() => import('./pages/RoomsPage'));
const MetricsPage = lazyPage(() => import('./pages/MetricsPage'));
const SummitFollowupPage = lazyPage(() => import('./pages/SummitFollowupPage'));
const ArchiePage = lazyPage(() => import('./pages/ArchiePage'));
const NotificationsPage = lazyPage(() => import('./pages/NotificationsPage'));
const PhotoPermissionPage = lazyPage(() => import('./pages/PhotoPermissionPage'));
const Summit27Page = lazyPage(() => import('./pages/Summit27Page'));
const LineupPage = lazyPage(() => import('./pages/LineupPage'));

/** /keynote-and-team was the Lineup page's address; forward, keeping the section a link asked for. */
function OldLineupAddress() {
  const { state, hash } = useLocation();
  return <Navigate to={{ pathname: '/lineup', hash }} state={state} replace />;
}

function LegacyApplicationRedirect() {
  const { role } = useParams();
  return <Navigate to={role ? `/login/${role}` : '/roles'} replace />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <GetTheAppBanner />
      <PageRouteBoundary>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/lineup" element={<LineupPage />} />
          {/* The page's old address (until Nov 25, 2026); keeps any section it was sent to. */}
          <Route path="/keynote-and-team" element={<OldLineupAddress />} />
          <Route path="/experts" element={<Navigate to="/lineup" state={{ scrollTo: 'experts' }} replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/login/:role" element={<LoginPage />} />
          <Route path="/apply/:role" element={<LegacyApplicationRedirect />} />
          <Route path="/profile" element={<ProfileSetupPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
          <Route path="/team/tracks/:key" element={<TeamTrackPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/archie" element={<ArchiePage />} />
          <Route path="/summit-27" element={<Navigate to="/summit-27/keynote" replace />} />
          <Route path="/summit-27/:tab" element={<Summit27Page />} />
          <Route path="/notifications" element={<NotificationsPage />} />
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
          <Route path="/expert/beamentor" element={<BeAMentorPage />} />
          <Route path="/admin/rooms" element={<RoomsPage />} />
          <Route path="/admin/metrics" element={<MetricsPage />} />
          <Route path="/admin/photo-permission" element={<PhotoPermissionPage />} />
          <Route path="/follow-up" element={<SummitFollowupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageRouteBoundary>
      <Summit27IntroHost />
    </>
  );
}
