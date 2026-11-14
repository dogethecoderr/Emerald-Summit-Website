import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Search, UserRound } from '@/components/icons';
import PhoneActions from '../components/PhoneActions';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { useRequireRole } from '../hooks/useRequireProfile';
import { roleLabelFor } from '../models/roles';
import { fetchVolunteerContacts, type VolunteerContact } from '../services/volunteerContacts';
import { Skeleton } from '@/components/ui/skeleton';

export default function DirectoryPage() {
  const { ready, redirect } = useRequireRole(['volunteer', 'ambassador', 'admin']);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<VolunteerContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    fetchVolunteerContacts().then((list) => {
      if (active) setPeople(list);
    }).catch((reason: Error) => {
      if (active) {
        setError(reason.message);
        setPeople([]);
      }
    });
    return () => { active = false; };
  }, [ready]);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready || people == null) return <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  const filtered = people.filter((person) => person.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <AppShell>
      <PageHeader label="Summit team" title="Volunteer hub" />
      <p className="mb-5 text-sm text-muted-foreground">Numbers are shared here so volunteers and admins can reach each other on Summit day.</p>
      <label className="relative mb-6 block max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input aria-label="Search volunteers by name" placeholder="Search by name…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-emerald-glow/60" />
      </label>
      {error ? <p role="alert" className="py-10 text-center text-sm text-muted-foreground">Could not load the volunteer hub. Please try again later.</p> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((person) => (
              <div key={person.id} className="glass rounded-2xl p-5">
                <div className="flex items-start gap-3"><UserRound className="mt-1 h-5 w-5 shrink-0 text-emerald" /><div className="min-w-0"><h2 className="break-words font-semibold">{person.name}</h2><p className="mt-1 text-xs text-muted-foreground">{roleLabelFor(person.role, person.subtype)}</p></div></div>
                <p className="mt-4 text-xs text-muted-foreground">Mobile number</p>
                {person.phone ? <PhoneActions phone={person.phone} className="mt-1" /> : <p className="mt-1 text-sm text-muted-foreground">Not provided</p>}
              </div>
            ))}
          </div>
          {filtered.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">{people.length === 0 ? 'No other volunteers or admins have signed up yet.' : 'No one matches your search.'}</p>}
        </>
      )}
    </AppShell>
  );
}
