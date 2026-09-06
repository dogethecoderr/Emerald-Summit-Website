import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import PersonCard from '../components/PersonCard';
import { useRequireProfile } from '../hooks/useRequireProfile';
import { useAuth } from '../context/AuthContext';
import { MOCK_PEOPLE } from '../models/people';
import { SIGN_IN_ROLES, roleByName } from '../models/roles';
import { getProfileSettings, profileToPerson } from '../services/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ROLE_FILTERS = ['All', ...SIGN_IN_ROLES.map((r) => r.name)];

export default function DirectoryPage() {
  const { ready, redirect } = useRequireProfile();
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready || profile == null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const viewerRoleName = (profile.role as string | undefined) ?? 'participant';
  const settings = getProfileSettings(profile);
  const selfPerson = settings.directoryVisible ? profileToPerson(profile) : null;

  const filtered = MOCK_PEOPLE.filter((p) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q || p.name.toLowerCase().includes(q) || p.org.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'All' || p.role === roleFilter;
    return matchesQuery && matchesRole;
  });

  const directoryPeople = selfPerson
    ? [selfPerson, ...filtered.filter((p) => p.id !== selfPerson.id)]
    : filtered;

  return (
    <AppShell>
      <PageHeader
        label="Emerald High School · Dublin, CA"
        title="Directory"
        sub="Browse participants, attendees, volunteers, experts, and Summit staff. Contact info respects each person's visibility settings."
      />

      <div className="mb-6 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or school…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-secondary/40 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-emerald-glow/60"
          />
        </div>
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-1">
          {ROLE_FILTERS.map((r) => {
            const active = roleFilter === r;
            return (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-emerald text-white'
                    : 'bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {r === 'All' ? 'All' : (roleByName(r)?.label ?? r)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {directoryPeople.map((p) => (
          <PersonCard key={p.id} person={p} viewerRoleName={viewerRoleName} />
        ))}
      </div>

      {directoryPeople.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No results for &ldquo;{query}&rdquo;
        </div>
      )}
    </AppShell>
  );
}
