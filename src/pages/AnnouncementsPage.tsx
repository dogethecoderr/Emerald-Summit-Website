import { Navigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
import { useRequireProfile } from '../hooks/useRequireProfile';
import { MOCK_ANNOUNCEMENTS } from '../models/announcements';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnnouncementsPage() {
  const { ready, redirect } = useRequireProfile();

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <AppShell>
      <PageHeader
        label="Live Updates"
        title="Announcements"
        sub="Logistics, schedule changes, and Summit news — with downloadable forms and guides posted alongside them."
      />
      <AnnouncementsPanel announcements={MOCK_ANNOUNCEMENTS} variant="full" />
    </AppShell>
  );
}
