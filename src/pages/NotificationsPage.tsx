// The bell's Notifications list, like the app's notifications_screen.dart:
// short notes about you (a new post that reaches you, a personal notice, a
// session starting within the hour), separate from Announcements. Tapping a note marks
// it read and opens what it's about; "Mark all as read" clears the bell.
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCheck } from '@/components/icons';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import NotificationList from '../components/NotificationList';
import { useRequireProfile } from '../hooks/useRequireProfile';
import { useNotifications } from '../context/NotificationsContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import BackButton from '../components/BackButton';

export default function NotificationsPage() {
  const { ready, redirect } = useRequireProfile();
  const { unreadCount, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  // Back to the page the bell was clicked on; opened directly (no history in the site), Home.
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/home'));

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <BackButton onClick={back} className="mb-7" />
        <PageHeader label="For you" title="Notifications" />
        <section className="glass rounded-2xl p-2 sm:p-4">
          <div className="flex items-center justify-between gap-2 px-2 pb-3">
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={markAllRead}>
                <CheckCheck className="h-4 w-4" /> Mark all as read
              </Button>
            )}
          </div>
          <NotificationList />
        </section>
      </div>
    </AppShell>
  );
}
