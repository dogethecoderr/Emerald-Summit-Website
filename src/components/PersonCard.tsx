import { type ReactNode } from 'react';
import { Mail, Phone, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { USER_ROLES, roleByName } from '../models/roles';
import type { Person, Visibility } from '../models/people';
import { personStatusLabel } from '../models/personStatus';
import { cn } from '@/lib/utils';
import { getDemoTracks } from '../services/offlineDemo';

export function canSeeField(vis: Visibility, viewerRoleName: string): boolean {
  if (vis === 'public') return true;
  if (vis === 'ambassadors') {
    return viewerRoleName === 'ambassador' || viewerRoleName === 'admin';
  }
  return false;
}

export default function PersonCard({
  person,
  viewerRoleName,
  showBio = true,
  revealPrivate = false,
  headerAction,
}: {
  person: Person;
  viewerRoleName: string;
  showBio?: boolean;
  /** Show email/phone/bio even when marked private (e.g. viewing your own card). */
  revealPrivate?: boolean;
  /** Optional control rendered in the top-right corner. */
  headerAction?: ReactNode;
}) {
  const role = roleByName(person.role) ?? USER_ROLES[0];
  const bioHidden =
    !revealPrivate && (person.bioVisible === 'private' || !showBio);
  const showEmail =
    revealPrivate || canSeeField(person.emailVisible, viewerRoleName);
  const showPhone =
    revealPrivate || canSeeField(person.phoneVisible, viewerRoleName);
  const registeredDisciplines = Array.from(new Set([
    person.discipline,
    ...(person.registeredDisciplines ?? []),
  ].filter((discipline): discipline is string => Boolean(discipline))));

  return (
    <div className="glass relative flex flex-col rounded-2xl p-5 transition-colors hover:border-emerald-glow/30">
      {headerAction && (
        <div className="absolute right-3 top-3 z-10">{headerAction}</div>
      )}
      <div className={cn('flex items-start gap-3', headerAction && 'pr-24')}>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: role.color }}
          aria-hidden
        >
          {person.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">
              {person.name}
            </span>
            {person.status !== 'none' && (
              <span className="shrink-0 text-emerald-glow" aria-hidden>
                {person.status === 'checkedIn' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {person.org}
          </div>
          <span
            className="mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: `${role.color}22`, color: role.color }}
          >
            {role.label}
          </span>
          {registeredDisciplines.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {registeredDisciplines.map((discipline) => {
                const track = getDemoTracks().find((item) => item.name === discipline);
                return (
                  <span
                    key={discipline}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${track?.color ?? '#64748B'}22`,
                      color: track?.color ?? '#64748B',
                    }}
                  >
                    {track?.label ?? discipline.replace(/[-_]/g, ' ')}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {!bioHidden && person.bio && (
        <p className="mt-3 flex-1 text-[13px] leading-relaxed text-muted-foreground">
          {person.bio}
        </p>
      )}

      <div
        className={cn(
          'mt-3 text-[11px] font-semibold',
          person.status === 'checkedIn' && 'text-emerald-mint',
          person.status === 'validated' && 'text-sky-400',
          person.status === 'none' && 'text-muted-foreground',
        )}
      >
        {personStatusLabel(person.status)}
      </div>

      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
        {showEmail && person.email ? (
          <a
            href={`mailto:${person.email}`}
            className="flex items-center gap-2 text-xs font-medium text-emerald-mint transition-colors hover:text-emerald-glow"
          >
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{person.email}</span>
          </a>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <Lock className="h-3.5 w-3.5 shrink-0" /> Email private
          </div>
        )}
        {showPhone && person.phone ? (
          <a
            href={`tel:${person.phone}`}
            className="flex items-center gap-2 text-xs font-medium text-emerald-mint transition-colors hover:text-emerald-glow"
          >
            <Phone className="h-3.5 w-3.5 shrink-0" />
            {person.phone}
          </a>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <Lock className="h-3.5 w-3.5 shrink-0" /> Phone private
          </div>
        )}
      </div>
    </div>
  );
}
