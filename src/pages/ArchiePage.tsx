// Archie, the app's AI assistant tab (archie_screen.dart). Not on the website
// yet: each chat calls Claude through the archie-chat Edge Function, which
// costs money per message, so it waits until we decide to open it to web
// visitors. Until then this page holds its place in the nav.
import { Navigate } from 'react-router-dom';
import { Sparkles } from '@/components/icons';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { useRequireProfile } from '../hooks/useRequireProfile';
import { Skeleton } from '@/components/ui/skeleton';

export default function ArchiePage() {
  const { ready, redirect } = useRequireProfile();
  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  return (
    <AppShell>
      <PageHeader label="Assistant" title="Archie" />
      <section className="glass mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald/15 text-emerald">
          <Sparkles className="h-7 w-7" />
        </span>
        <h2 className="font-display text-2xl font-semibold">Coming soon</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Archie answers questions about the summit: what's on, where it is and when. It isn't on the website yet.
        </p>
      </section>
    </AppShell>
  );
}
