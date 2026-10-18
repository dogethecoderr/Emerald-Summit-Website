import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Search,
  FileText,
  Link2,
  Play,
  BookOpen,
  Presentation,
  Download,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import TrackPill from '../components/TrackPill';
import { useRequireProfile } from '../hooks/useRequireProfile';
import {
  MOCK_RESOURCES,
  type ResourceCategory,
  type ResourceType,
} from '../models/resources';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<ResourceType, LucideIcon> = {
  PDF: FileText,
  Link: Link2,
  Video: Play,
  Form: BookOpen,
  Deck: Presentation,
};

const CATEGORIES: ('All' | ResourceCategory)[] = [
  'All',
  'Maps',
  'Guides',
  'Track Briefs',
  'Slides',
  'Sponsors',
  'Forms',
];

export default function ResourcesPage() {
  const { ready, redirect } = useRequireProfile();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const filtered = MOCK_RESOURCES.filter((r) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q);
    const matchesCategory = category === 'All' || r.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <AppShell>
      <PageHeader
        label="Document Library"
        title="Resources"
      />

      <div className="mb-6 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search resources…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-secondary/40 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-emerald-glow/60"
          />
        </div>
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                category === c
                  ? 'bg-emerald text-white'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r) => {
          const Icon = TYPE_ICON[r.type];
          return (
            <button
              key={r.id}
              onClick={() =>
                toast.success(`Downloading “${r.title}”`, {
                  description: 'File downloads are simulated in demo mode.',
                })
              }
              className="glass group flex flex-col rounded-2xl p-5 text-left transition-colors hover:border-emerald-glow/35"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald/15 text-emerald-mint ring-1 ring-emerald-glow/25">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  <Download className="h-3 w-3" /> Get
                </span>
              </div>
              <h3 className="mt-3 text-[14px] font-semibold leading-snug">
                {r.title}
              </h3>
              <p className="mt-1 flex-1 text-[12px] leading-relaxed text-muted-foreground">
                {r.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {r.discipline && <TrackPill track={r.discipline} />}
                <span className="rounded-full bg-secondary/70 px-2 py-0.5 font-semibold">
                  {r.type}
                  {r.size ? ` · ${r.size}` : ''}
                </span>
                <span className="ml-auto">Updated {r.updated}</span>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No resources match your search.
        </div>
      )}
    </AppShell>
  );
}
