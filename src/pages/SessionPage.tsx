// One session's page, ported from the app's session_detail_screen.dart.
// Everyone gets the Session tab with "Add to my day"; admins, the session's
// managers and its editors also get Participants, Experts, Volunteers and
// Metrics. Every write goes through the same RPCs as the app.
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Award, ChevronLeft, Clock, Eye, Info, MapPin, Pencil, Plus, User, Users } from '@/components/icons';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { useTheme } from '../context/ThemeContext';
import { needsProfileSetup } from '../services/auth';
import { canEditVerse, useSummitContent, loadSummitContent } from '../services/summitContent';
import { MOCK_SESSIONS, SESSION_ROOMS_ENABLED, type Session } from '../models/sessions';
import { disciplineByName } from '../models/disciplines';
import { rgba, vibeFor } from '../models/verseVibes';
import {
  addModesForRole,
  conflictMessage,
  formatDeadline,
  mustHandOff,
  normalizeTeamCode,
  participationClosed,
  participationGradeBlock,
  STATUS_LABEL,
  type AddMode,
  type GradeBlock,
  type MyProject,
  type ParticipationType,
  type TeamMember,
} from '../models/registration';
import {
  fetchMyAnswers,
  fetchMyProject,
  fetchSessionExperts,
  removeTeamMember,
  setSessionManage,
  TeamCodeError,
  toggleRegistration,
  transferTeamOwnership,
  updateMyRegistration,
} from '../services/sessionRegistration';
import RegistrationForm, { projectPromptOf, type RegistrationFormResult } from '../components/session/RegistrationForm';
import ProjectCard, { TeamCodeChip } from '../components/session/ProjectCard';
import SessionRoster from '../components/session/SessionRoster';
import SessionVolunteers from '../components/session/SessionVolunteers';
import { assignVolunteerOverridingConflict, fetchConflictOverrides } from '../services/organizer';
import SessionMetrics from '../components/session/SessionMetrics';
import { SessionEditorDialog } from '../components/verse/ContentEditors';
import { fetchSessionPhotos, splitHero, type SessionPhoto } from '../services/sessionPhotos';
import { suggestedSessions } from '../models/suggested';
import SuggestedSessionCard from '../components/session/SuggestedSessionCard';
import { REGISTRATION_CLOSED_MESSAGE, TBD, useSiteSwitches } from '../services/siteSwitches';

/** Why Participate is greyed out for a middle schooler, in the chooser. */
const GRADE_BLOCK_CHOICE_TEXT: Record<GradeBlock, string> = {
  eighth_grade_not_allowed: "This session isn't open to 8th graders. You can spectate it.",
  middle_school_not_allowed: 'Participating is for high schoolers. You can spectate.',
};

const MODE_TEXT: Record<AddMode, { title: string; blurb: string; icon: typeof Plus }> = {
  participate: { title: 'Participate', blurb: "Join in and take part. You'll tell us about your project first.", icon: User },
  spectate: { title: 'Spectate', blurb: 'Watch and follow along, without taking part.', icon: Eye },
  expert: { title: 'Serve as an expert', blurb: 'Lead or advise as the session expert.', icon: Award },
  manage: { title: 'Manage this session', blurb: "Run this session. It's added to your schedule.", icon: Users },
};

const TYPE_FOR: Record<Exclude<AddMode, 'manage'>, ParticipationType> = {
  participate: 'participant',
  spectate: 'spectator',
  expert: 'expert',
};

/** "9:00 AM – 10:30 AM" from the stored 24-hour times, or "Time TBD" while times are hidden. */
function timeLabel(s: Session, showTimes: boolean): string {
  if (!showTimes) return `Time ${TBD}`;
  const show = (hhmm?: string) => {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  return s.start && s.end ? `${show(s.start)} – ${show(s.end)}` : s.time;
}

// `action` adds a second button, e.g. an admin's "Manage anyway".
type Blocked = { title: string; body: string; action?: { label: string; run: () => void } };

export default function SessionPage() {
  useSummitContent();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session: auth, profile, loadingProfile } = useAuth();
  const schedule = useSchedule();
  const { theme } = useTheme();
  const switches = useSiteSwitches();
  const session = MOCK_SESSIONS.find((s) => s.id === id);

  const role = profile?.role as string | undefined;
  const signedIn = auth != null && !loadingProfile && profile != null && !needsProfileSetup(profile);
  const waitingExpert = role === 'expert' && profile?.expert_status !== 'approved';
  const registeredType: ParticipationType | null = !session ? null
    : schedule.mySchedule.includes(session.id) ? 'participant'
      : schedule.expertSchedule.includes(session.id) ? 'expert'
        : schedule.spectating.includes(session.id) ? 'spectator' : null;
  const managing = session ? schedule.volunteerSchedule.includes(session.id) : false;
  const canEdit = session ? canEditVerse(profile, session.track) : false;
  const canMarkAttendance = role === 'admin' || managing;
  const canSeeRoster = signedIn && (canMarkAttendance || canEdit);

  const [busy, setBusy] = useState(false);
  const [experts, setExperts] = useState<string[]>([]);
  const [project, setProject] = useState<MyProject | null>(null);
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [form, setForm] = useState<null | { editing: boolean; answers: Record<string, string> }>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [newTeamCode, setNewTeamCode] = useState<{ code: string; name: string } | null>(null);
  const [ownerPick, setOwnerPick] = useState<null | { title: string; blurb: string; project: MyProject; resolve: (id: string | null) => void }>(null);
  const [leaving, setLeaving] = useState<null | { name: string; error: string | null }>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [photoSet, setPhotoSet] = useState<{ sessionId: string; photos: SessionPhoto[] } | null>(null);

  const sessionId = session?.id;
  const loadProject = useCallback(async () => {
    if (!sessionId || registeredType !== 'participant') {
      setProject(null);
      setProjectLoaded(false);
      return;
    }
    try {
      setProject(await fetchMyProject(sessionId));
    } catch {
      setProject(null);
    }
    setProjectLoaded(true);
  }, [sessionId, registeredType]);
  useEffect(() => { void loadProject(); }, [loadProject]);

  const loadExperts = useCallback(() => {
    if (!sessionId) return;
    fetchSessionExperts(sessionId).then(setExperts).catch(() => setExperts([]));
  }, [sessionId]);
  useEffect(loadExperts, [loadExperts]);

  // The session's photos, reloaded when the editor closes since it may have
  // added or removed some.
  useEffect(() => {
    if (!sessionId || editorOpen) return;
    let live = true;
    fetchSessionPhotos(sessionId).then((photos) => { if (live) setPhotoSet({ sessionId, photos }); });
    return () => { live = false; };
  }, [sessionId, editorOpen]);

  // A + on a session card lands here with { add: true }: open the chooser.
  const wantsAdd = (location.state as { add?: boolean } | null)?.add === true;
  useEffect(() => {
    if (!wantsAdd || !session || schedule.loading || loadingProfile || !switches.loaded) return;
    navigate(location.pathname, { replace: true, state: null });
    if (signedIn && !registeredType && !managing && !waitingExpert) void startAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsAdd, session, schedule.loading, loadingProfile, switches.loaded]);

  if (!session) {
    // The catalog may still be loading from the database.
    return MOCK_SESSIONS.length === 0
      ? <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
      : <Navigate to="/disciplines" replace />;
  }

  const s = session;
  const keynote = s.track === 'keynote';
  const accent = vibeFor(keynote ? null : s.track, theme).accent;
  const disciplineLabel = s.disciplineName || disciplineByName(s.track)?.label || '';
  const deadline = s.participantDeadline ? new Date(s.participantDeadline) : null;
  const closed = participationClosed(s.participantDeadline);
  // Middle schoolers can always spectate; 8th graders participate only where
  // the leads allowed it. The server refuses it too (register_for_session).
  const gradeBlock = participationGradeBlock(profile?.details?.grade, s.allowEighthGraders);
  // While times are hidden, a deadline reads "TBD" instead of its date.
  const showTimes = switches.showTimes;
  const deadlineText = (d: Date) => (showTimes ? formatDeadline(d) : TBD);
  const left = Math.max(0, s.capacity - s.enrolled);
  // The explicit hero, or the first photo when none was set, as in the app.
  const photos = photoSet?.sessionId === s.id ? photoSet.photos : [];
  const { hero, gallery } = splitHero(s.heroImageUrl, photos);
  // More sessions in this discipline that fit an open slot on their day.
  const suggested = signedIn
    ? suggestedSessions(s, MOCK_SESSIONS, new Set([
      ...schedule.mySchedule, ...schedule.expertSchedule, ...schedule.spectating, ...schedule.volunteerSchedule,
    ]))
    : [];

  const guarded = async <T,>(call: () => Promise<T>): Promise<T | null> => {
    if (busy) return null;
    setBusy(true);
    try {
      return await call();
    } catch {
      toast.error("Couldn't update your day. Check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const afterChange = async () => {
    await Promise.all([schedule.reload(), loadSummitContent()]);
    loadExperts();
  };

  /** Asks which teammate takes over when the caller owns a team with others on it. */
  const handOffIfNeeded = async (action: string): Promise<{ proceed: boolean; newOwnerId?: string }> => {
    let fresh: MyProject | null = project;
    try {
      fresh = await fetchMyProject(s.id);
    } catch { /* use what the page has */ }
    if (!mustHandOff(fresh)) return { proceed: true };
    const picked = await new Promise<string | null>((resolve) => setOwnerPick({
      title: 'Choose a new owner',
      blurb: `You own "${fresh!.projectName}". Pick the teammate who takes it over before you ${action}.`,
      project: fresh!,
      resolve,
    }));
    return picked ? { proceed: true, newOwnerId: picked } : { proceed: false };
  };

  const register = async (type: ParticipationType, extra?: RegistrationFormResult) => {
    const result = await guarded(() => toggleRegistration(s.id, { add: true, type, answers: extra?.answers, project: extra?.project }));
    if (!result) return;
    switch (result.outcome) {
      case 'added':
        await afterChange();
        toast.success(`Added "${s.title}" (${type === 'participant' ? 'participating' : type === 'spectator' ? 'spectating' : 'expert'})`);
        if (result.teamCode) setNewTeamCode({ code: result.teamCode, name: extra?.project && 'projectName' in extra.project ? extra.project.projectName ?? '' : '' });
        break;
      case 'removed':
        await afterChange();
        break;
      case 'invalid_project':
        setBlocked({ title: "Couldn't register", body: result.message });
        break;
      case 'full':
        setBlocked({ title: 'Session full', body: `This session has reached its capacity of ${s.capacity}. You can still join the waitlist on the day.` });
        break;
      case 'conflict':
        setBlocked({ title: 'Time conflict', body: conflictMessage(result.conflictKind, result.conflictingTitle, role) });
        break;
      case 'participation_closed':
        setBlocked({
          title: 'Participant registration closed',
          body: `Registration to participate closed${deadline && showTimes ? ` on ${formatDeadline(deadline)}` : ''}. You can still add this session as a spectator while seats are left.`,
        });
        break;
    }
  };

  const setManage = async (manage: boolean) => {
    const result = await guarded(() => setSessionManage(s.id, manage));
    if (!result) return;
    if (result.outcome === 'conflict') {
      const clash = `Managing this overlaps with "${result.conflictingTitle ?? 'another session'}", which is already on your schedule.`;
      // Offer the override only once the backend has it (volunteer_conflict_override.sql).
      const canOverride = result.conflictKind !== 'registered_this' && auth != null
        && (await fetchConflictOverrides(s.id)) != null;
      setBlocked({
        title: 'Time conflict',
        body: result.conflictKind === 'registered_this'
          ? "You're signed up for this session. Remove it from your day first to manage it."
          : canOverride ? `${clash} You can manage it anyway if you'll cover both.` : clash,
        action: canOverride && auth ? { label: 'Manage anyway', run: () => void manageOverClash(auth.user.id) } : undefined,
      });
      return;
    }
    await afterChange();
    toast.success(manage ? `You're now managing "${s.title}"` : `Stopped managing "${s.title}"`);
  };

  // Admin only: manage this session over a time clash (volunteer_conflict_override.sql).
  const manageOverClash = async (userId: string) => {
    setBlocked(null);
    const result = await guarded(() => assignVolunteerOverridingConflict(s.id, userId));
    if (!result) return;
    if (result.outcome === 'conflict') {
      setBlocked({ title: 'Time conflict', body: "You're signed up for this session. Remove it from your day first to manage it." });
      return;
    }
    await afterChange();
    toast.success(`You're now managing "${s.title}"`);
  };

  async function startAdd() {
    if (!switches.registrationOpen) {
      toast(REGISTRATION_CLOSED_MESSAGE);
      return;
    }
    if (role === 'attendee') {
      await register('spectator');
      return;
    }
    setChoosing(true);
  }

  const pickMode = async (mode: AddMode) => {
    setChoosing(false);
    if (mode === 'manage') return setManage(true);
    if (mode === 'participate') return setForm({ editing: false, answers: {} });
    await register(TYPE_FOR[mode]);
  };

  const removeFromDay = async () => {
    let newOwnerId: string | undefined;
    if (registeredType === 'participant') {
      const handOff = await handOffIfNeeded('remove this session');
      if (!handOff.proceed) return;
      newOwnerId = handOff.newOwnerId;
    }
    const result = await guarded(() => toggleRegistration(s.id, { add: false, newOwnerId }));
    if (!result) return;
    if (result.outcome === 'invalid_project') {
      setBlocked({ title: "Couldn't remove this session", body: result.message });
      void loadProject();
      return;
    }
    await afterChange();
    toast.success(result.outcome === 'removed' ? `Removed "${s.title}" from your day` : 'Updated your day');
  };

  const editRegistration = async () => {
    let answers: Record<string, string> = {};
    try {
      answers = await fetchMyAnswers(s.id);
    } catch { /* start blank */ }
    setForm({ editing: true, answers });
  };

  const submitForm = async (result: RegistrationFormResult) => {
    const editing = form?.editing;
    setForm(null);
    if (!editing) {
      await register('participant', result);
      return;
    }
    const current = project;
    const leavingTeam = current?.isTeam === true && (
      result.project.action === 'stayOnTeam' ? false
        : result.project.action === 'joinTeam' ? normalizeTeamCode(result.project.teamCode) !== current.teamCode
          : true);
    let newOwnerId: string | undefined;
    if (leavingTeam) {
      const handOff = await handOffIfNeeded('leave');
      if (!handOff.proceed) return;
      newOwnerId = handOff.newOwnerId;
    }
    try {
      const updated = await updateMyRegistration(s.id, result.answers, result.project, newOwnerId);
      setProject(updated);
      if (result.project.action === 'createTeam' && updated.teamCode) setNewTeamCode({ code: updated.teamCode, name: updated.projectName });
      else toast.success('Your registration was updated');
    } catch (e) {
      if (e instanceof TeamCodeError) setBlocked({ title: "Couldn't update your team", body: e.message });
      else toast.error("Couldn't save your changes. Try again.");
    }
  };

  const leaveTeam = async (name: string) => {
    setLeaving(null);
    const handOff = await handOffIfNeeded('leave');
    if (!handOff.proceed) return;
    let answers: Record<string, string> = {};
    try {
      answers = await fetchMyAnswers(s.id);
    } catch { /* keep none */ }
    try {
      setProject(await updateMyRegistration(s.id, answers, { action: 'solo', projectName: name }, handOff.newOwnerId));
      toast.success("You left the team. You're now registered solo.");
    } catch (e) {
      if (e instanceof TeamCodeError) {
        setBlocked({ title: "Couldn't leave the team", body: e.message });
        void loadProject();
      } else toast.error("Couldn't leave the team. Try again.");
    }
  };

  const transfer = async () => {
    let fresh: MyProject | null = project;
    try {
      fresh = await fetchMyProject(s.id);
    } catch { /* use what the page has */ }
    if (!mustHandOff(fresh)) return;
    const picked = await new Promise<string | null>((resolve) => setOwnerPick({
      title: 'Transfer ownership',
      blurb: `Pick the teammate who'll own "${fresh!.projectName}". You'll stay on the team.`,
      project: fresh!,
      resolve,
    }));
    if (!picked) return;
    try {
      await transferTeamOwnership(s.id, picked);
      toast.success(`${fresh!.members.find((m) => m.id === picked)?.name ?? 'Your teammate'} now owns the team`);
    } catch (e) {
      if (e instanceof TeamCodeError) setBlocked({ title: "Couldn't transfer ownership", body: e.message });
      else toast.error("Couldn't transfer ownership. Try again.");
    }
    void loadProject();
  };

  const removeMember = async (member: TeamMember) => {
    setRemoving(null);
    try {
      await removeTeamMember(s.id, member.id);
      toast.success(`Removed ${member.name} from your team`);
    } catch (e) {
      if (e instanceof TeamCodeError) setBlocked({ title: "Couldn't remove them", body: e.message });
      else toast.error("Couldn't remove them. Try again.");
    }
    void loadProject();
  };

  const about = (
    <div className="space-y-6">
      {hero && (
        <img src={hero} alt="" width={1200} height={525} className="aspect-[16/7] w-full rounded-2xl bg-muted object-cover" />
      )}
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2"><Clock className="h-4 w-4" style={{ color: accent }} /> {timeLabel(s, showTimes)}</p>
        {SESSION_ROOMS_ENABLED && s.room && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" style={{ color: accent }} /> {s.room}</p>}
        {experts.length > 0 && (
          <p className="flex items-center gap-2"><User className="h-4 w-4" style={{ color: accent }} /> {experts.length === 1 ? 'Expert' : 'Experts'}: {experts.join(', ')}</p>
        )}
        <p className="flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: accent }} />
          {left === 0 ? `Full (${s.enrolled}/${s.capacity})` : `${left} of ${s.capacity} seats left`}
        </p>
      </div>

      {deadline && (
        <div className="rounded-2xl border border-border p-4 text-sm">
          <p className="font-semibold">{closed ? 'Participant registration closed' : 'Participant registration deadline'}</p>
          <p className="mt-1 text-muted-foreground">
            {!showTimes
              ? TBD
              : closed
              ? `Closed ${formatDeadline(deadline)}. You can still spectate while seats are left.`
              : `Register to participate by ${formatDeadline(deadline)}. After that, you can only spectate.`}
          </p>
        </div>
      )}

      <section>
        <h2 className="mb-2 font-semibold">About this session</h2>
        <p className="whitespace-pre-line leading-relaxed">{s.description}</p>
      </section>
      {(s.pageBlocks ?? []).filter((b) => b.title.trim() || b.body.trim()).map((b, i) => (
        <section key={i}>
          {b.title.trim() && <h2 className="mb-2 font-semibold">{b.title}</h2>}
          {b.body.trim() && <p className="whitespace-pre-line leading-relaxed">{b.body}</p>}
        </section>
      ))}
      {gallery.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Gallery</h2>
          <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {gallery.map((p) => (
              <li key={p.name} className="shrink-0 snap-start">
                <img src={p.url} alt="" width={220} height={160} loading="lazy" className="h-40 w-56 rounded-xl bg-muted object-cover" />
              </li>
            ))}
          </ul>
        </section>
      )}
      {s.sponsor && <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm">{s.sponsor}</p>}

      <div className="space-y-3">
        {!signedIn ? (
          auth == null ? (
            <Button asChild className="bg-emerald text-white hover:bg-emerald-deep"><Link to="/roles">Sign in to add this to your day</Link></Button>
          ) : null
        ) : waitingExpert ? (
          <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm">An admin has to approve your expert account before you can add sessions.</p>
        ) : managing ? (
          <div className="space-y-3 rounded-2xl bg-emerald/10 p-4 text-sm">
            <p>{role === 'admin' ? "You're managing this session." : "You're managing this session. It was added to your schedule by an admin."}</p>
            {role === 'admin' && <Button variant="outline" size="sm" disabled={busy} onClick={() => void setManage(false)}>Stop managing</Button>}
          </div>
        ) : registeredType ? (
          <>
            <p className="rounded-2xl bg-secondary px-4 py-3 text-sm">{STATUS_LABEL[registeredType]}</p>
            {registeredType === 'participant' && (
              <>
                {projectLoaded && (
                  <ProjectCard
                    project={project}
                    onLeave={() => setLeaving({ name: project?.projectName ?? '', error: null })}
                    onTransfer={() => void transfer()}
                    onRemoveMember={setRemoving}
                  />
                )}
                <Button variant="outline" onClick={() => void editRegistration()}>
                  <Pencil className="h-4 w-4" /> {projectLoaded && project == null ? 'Add my project details' : 'Edit my registration'}
                </Button>
              </>
            )}
            <div>
              <Button variant="destructive" disabled={busy} onClick={() => void removeFromDay()}>Remove from my day</Button>
            </div>
          </>
        ) : !switches.registrationOpen ? (
          // Greyed out until website_registration_open is set on the backend.
          // aria-disabled (not disabled) so a tap still explains why.
          <span className="group relative inline-block">
            <Button
              aria-disabled="true"
              aria-describedby="registration-closed-tip"
              onClick={() => toast(REGISTRATION_CLOSED_MESSAGE)}
              className="cursor-not-allowed bg-muted text-muted-foreground shadow-none hover:bg-muted"
            >
              <Plus className="h-4 w-4" /> Add to my day
            </Button>
            <span
              id="registration-closed-tip"
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-0 mb-2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1 text-[12px] font-semibold text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {REGISTRATION_CLOSED_MESSAGE}
            </span>
          </span>
        ) : (
          <Button disabled={busy || schedule.loading} onClick={() => void startAdd()} className="bg-emerald text-white hover:bg-emerald-deep">
            <Plus className="h-4 w-4" /> Add to my day
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" onClick={() => setEditorOpen(true)}><Pencil className="h-4 w-4" /> Edit session page</Button>
        )}
        {schedule.scheduleError && signedIn && (
          <p role="alert" className="text-sm text-destructive">We could not load your saved schedule. Refresh the page to retry.</p>
        )}
      </div>

      {suggested.length > 0 && (
        <section className="border-t border-border pt-6">
          <h2 className="font-semibold">Sessions similar to this</h2>
          <p className="mt-1 text-xs text-muted-foreground">More in {disciplineLabel || 'this discipline'} that fit an open slot on your schedule.</p>
          <div className="-mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {suggested.map((x) => (
              <SuggestedSessionCard
                key={x.id}
                session={x}
                time={timeLabel(x, showTimes)}
                onAdd={() => navigate(`/sessions/${x.id}`, { state: { add: true } })}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <header className="mb-6">
          {disciplineLabel && <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>{disciplineLabel}</p>}
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">{s.title}</h1>
          <div className="mt-3 h-1 w-16 rounded-full" style={{ background: rgba(accent, 0.8) }} />
        </header>

        {canSeeRoster ? (
          <Tabs defaultValue="session">
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="session">Session</TabsTrigger>
              <TabsTrigger value="participants">Participants</TabsTrigger>
              <TabsTrigger value="experts">Experts</TabsTrigger>
              <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
            </TabsList>
            <TabsContent value="session">{about}</TabsContent>
            <TabsContent value="participants">
              <SessionRoster session={s} types={['participant', 'spectator']} canMarkAttendance={canMarkAttendance} emptyMessage="No participants have registered for this session yet." />
            </TabsContent>
            <TabsContent value="experts">
              <SessionRoster session={s} types={['expert']} canMarkAttendance={canMarkAttendance} emptyMessage="No experts have registered for this session yet." />
            </TabsContent>
            <TabsContent value="volunteers"><SessionVolunteers session={s} canAssign={role === 'admin'} /></TabsContent>
            <TabsContent value="metrics"><SessionMetrics session={s} /></TabsContent>
          </Tabs>
        ) : about}
      </div>

      {/* Add to my day: the role's choices, like the app's bottom sheet. */}
      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add to my day</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {addModesForRole(role).map((m) => {
              const Icon = MODE_TEXT[m].icon;
              const gradeBlocked = m === 'participate' && gradeBlock != null;
              const disabled = m === 'participate' && (closed || gradeBlocked);
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => void pickMode(m)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald" />
                  <span>
                    <span className="block font-semibold">{MODE_TEXT[m].title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {gradeBlocked
                        ? GRADE_BLOCK_CHOICE_TEXT[gradeBlock!]
                        : disabled && deadline
                        ? showTimes ? `Registration to participate closed on ${formatDeadline(deadline)}.` : 'Registration to participate has closed.'
                        : m === 'participate' && deadline
                          ? `${MODE_TEXT[m].blurb} Closes ${deadlineText(deadline)}.`
                          : MODE_TEXT[m].blurb}
                    </span>
                  </span>
                </button>
              );
            })}
            {role === 'volunteer' && (
              <p className="flex gap-2 pt-1 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                To manage this session, an admin has to assign you. You'll be notified if they do.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {form && (
        <RegistrationForm
          open
          session={s}
          editing={form.editing}
          initialProject={form.editing ? project : null}
          initialAnswers={form.answers}
          onCancel={() => setForm(null)}
          onSubmit={(r) => void submitForm(r)}
        />
      )}

      <SessionEditorDialog target={editorOpen ? { verse: s.track, session: s } : null} onClose={() => setEditorOpen(false)} />

      <Dialog open={blocked != null} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{blocked?.title}</DialogTitle>
            <DialogDescription>{blocked?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {blocked?.action ? (
              <>
                <Button variant="outline" onClick={() => setBlocked(null)}>Cancel</Button>
                <Button disabled={busy} onClick={blocked.action.run} className="bg-emerald text-white hover:bg-emerald-deep">
                  {blocked.action.label}
                </Button>
              </>
            ) : (
              <Button onClick={() => setBlocked(null)}>Got it</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newTeamCode != null} onOpenChange={(o) => !o && setNewTeamCode(null)}>
        <DialogContent className="text-center sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Your team is ready</DialogTitle>
            <DialogDescription className="text-center">{newTeamCode?.name}</DialogDescription>
          </DialogHeader>
          {newTeamCode && <div className="flex justify-center"><TeamCodeChip code={newTeamCode.code} /></div>}
          <p className="text-sm text-muted-foreground">
            Share this code with your teammates. They enter it when they register for this session to join your team. You can always find it again on this page.
          </p>
          <DialogFooter><Button onClick={() => setNewTeamCode(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ownerPick != null} onOpenChange={(o) => { if (!o) { ownerPick?.resolve(null); setOwnerPick(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ownerPick?.title}</DialogTitle>
            <DialogDescription>{ownerPick?.blurb}</DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border">
            {ownerPick?.project.members.filter((m) => !m.isOwner && m.id).map((m) => (
              <li key={m.id}>
                <button type="button" className="w-full py-2.5 text-left font-medium hover:bg-accent/50" onClick={() => { ownerPick.resolve(m.id); setOwnerPick(null); }}>
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={leaving != null} onOpenChange={(o) => !o && setLeaving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave team?</DialogTitle>
            <DialogDescription>You'll stay registered for this session as a solo participant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="solo-name">{projectPromptOf(s)}</Label>
            <Input id="solo-name" value={leaving?.name ?? ''} onChange={(e) => setLeaving((l) => l && { ...l, name: e.target.value, error: null })} />
            {leaving?.error && <p className="text-sm text-destructive">{leaving.error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaving(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const name = leaving?.name.trim() ?? '';
                if (!name) setLeaving((l) => l && { ...l, error: 'Please answer this to go solo.' });
                else void leaveTeam(name);
              }}
            >Leave team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removing != null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>
              They'll be taken off your team but stay registered for this session, and they'll be notified. They won't be able to rejoin your team with its code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => removing && void removeMember(removing)}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

