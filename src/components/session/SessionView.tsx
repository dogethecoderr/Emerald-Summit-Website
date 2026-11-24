// One session's page, ported from the app's session_detail_screen.dart.
// Everyone gets the Session tab with "Add to my day"; admins, the session's
// managers and its editors also get Participants, Experts, Volunteers and
// Metrics. Every write goes through the same RPCs as the app.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Award, Clock, Eye, Info, MapPin, Pencil, Plus, User, Users } from '@/components/icons';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { useTheme } from '../../context/ThemeContext';
import { needsProfileSetup, saveExpertLinkedIn } from '../../services/auth';
import { canEditVerse, useSummitContent, loadSummitContent } from '../../services/summitContent';
import { MOCK_SESSIONS, SESSION_ROOMS_ENABLED, type Session } from '../../models/sessions';
import { disciplineByName } from '../../models/disciplines';
import { rgba, vibeFor } from '../../models/verseVibes';
import {
  addModesForRole,
  conflictMessage,
  participationLimitMessage,
  formatDeadline,
  mustHandOff,
  normalizeTeamCode,
  registrationAsksAnything,
  participationClosed,
  participationGradeBlock,
  isEighthGradeParticipant,
  STATUS_LABEL,
  type AddMode,
  type GradeBlock,
  type MyProject,
  type ParticipationType,
  type TeamMember,
} from '../../models/registration';
import {
  fetchMyAnswers,
  fetchMyProject,
  fetchSessionExpertProfiles,
  removeTeamMember,
  setSessionManage,
  TeamCodeError,
  toggleRegistration,
  transferTeamOwnership,
  updateMyRegistration,
  type SessionExpert,
} from '../../services/sessionRegistration';
import SessionExperts from './SessionExperts';
import ExpertTrackDialog from './ExpertTrackDialog';
import { LINKEDIN_URL_KEY, LINKEDIN_VISIBLE_KEY, linkedInAnswers } from '../../models/expertLinkedIn';
import RegistrationForm, { projectPromptOf, type RegistrationFormResult } from './RegistrationForm';
import ProjectCard, { TeamCodeChip } from './ProjectCard';
import SessionRoster from './SessionRoster';
import SessionVolunteers from './SessionVolunteers';
import ReplaceScheduleDialog, { type ReplaceRequest } from './ReplaceScheduleDialog';
import { assignManagerReplacingConflicts, previewManagerAssignment } from '../../services/organizer';
import SessionMetrics from './SessionMetrics';
import EighthGradeBadge from '../verse/EighthGradeBadge';
import { SessionEditorDialog } from '../verse/ContentEditors';
import { fetchSessionPhotos, splitHero, type SessionPhoto } from '../../services/sessionPhotos';
import { suggestedSessions } from '../../models/suggested';
import SuggestedSessionCard from './SuggestedSessionCard';
import { REGISTRATION_CLOSED_MESSAGE, TBD, useSiteSwitches } from '../../services/siteSwitches';

/** Why Participate is greyed out for a middle schooler, in the chooser. */
const GRADE_BLOCK_CHOICE_TEXT: Record<GradeBlock, string> = {
  eighth_grade_not_allowed: "This track isn't open to 8th graders. You can spectate it.",
  middle_school_not_allowed: 'Participating is for high schoolers. You can spectate.',
};

const MODE_TEXT: Record<AddMode, { title: string; blurb: string; icon: typeof Plus }> = {
  participate: { title: 'Participate', blurb: "Join in and take part. You'll tell us about your project first.", icon: User },
  spectate: { title: 'Spectate', blurb: 'Watch and follow along, without taking part.', icon: Eye },
  expert: { title: 'Serve as an expert', blurb: 'Lead or advise as the track expert.', icon: Award },
  manage: { title: 'Manage this track', blurb: "Run this track. It's added to your schedule.", icon: Users },
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

type Blocked = { title: string; body: string };

/**
 * A session's page content: header, details, registration and (for editors
 * and managers) the roster tabs. It has no page around it: the discipline
 * page shows it inside its open world, and SessionPage (`/sessions/:id`)
 * gives it a world of its own.
 */
export default function SessionView({
  id,
  wantsAdd = false,
  onAddHandled,
  onOpenSession,
}: {
  id: string;
  /** Opened from a + : start "Add to my day" once everything has loaded. */
  wantsAdd?: boolean;
  onAddHandled?: () => void;
  /** Opens another session (the suggestions), with its chooser if `add`. */
  onOpenSession: (id: string, opts?: { add?: boolean }) => void;
}) {
  useSummitContent();
  const { session: auth, profile, loadingProfile, refreshProfile } = useAuth();
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
  const [experts, setExperts] = useState<SessionExpert[]>([]);
  const [project, setProject] = useState<MyProject | null>(null);
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [choosing, setChoosing] = useState(false);
  // Serving as an expert first shows who will see their profile and asks about LinkedIn.
  const [expertConfirm, setExpertConfirm] = useState(false);
  const [savingLinkedIn, setSavingLinkedIn] = useState(false);
  const [form, setForm] = useState<null | { editing: boolean; answers: Record<string, string> }>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [replacing, setReplacing] = useState<ReplaceRequest | null>(null);
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
    fetchSessionExpertProfiles(sessionId).then(setExperts).catch(() => setExperts([]));
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

  // A + on a session card lands here with wantsAdd: open the chooser.
  useEffect(() => {
    if (!wantsAdd || !session || schedule.loading || loadingProfile || !switches.loaded) return;
    onAddHandled?.();
    if (signedIn && !registeredType && !managing && !waitingExpert) void startAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsAdd, session, schedule.loading, loadingProfile, switches.loaded]);

  if (!session) {
    // The catalog may still be loading from the database.
    return MOCK_SESSIONS.length === 0
      ? <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
      : <p className="py-16 text-center text-muted-foreground">This track isn't available anymore.</p>;
  }

  const s = session;
  const keynote = s.track === 'keynote';
  // The page sits in its discipline's world, like the discipline's own page.
  const vibe = vibeFor(keynote ? null : s.track, theme);
  const accent = vibe.accent;
  const disciplineLabel = s.disciplineName || disciplineByName(s.track)?.label || '';
  const deadline = s.participantDeadline ? new Date(s.participantDeadline) : null;
  const closed = participationClosed(s.participantDeadline);
  // Going solo asks for a project name only where the track still asks one.
  const asksProjectName = s.askQuestions !== false && s.askProjectName !== false;
  // Middle schoolers can always spectate; 8th graders participate only where
  // the leads allowed it. The server refuses it too (register_for_session).
  const gradeBlock = participationGradeBlock(profile?.details?.grade, s.allowEighthGraders);
  const eighthGrade = isEighthGradeParticipant(profile as Parameters<typeof isEighthGradeParticipant>[0]);
  // While times are hidden, a deadline reads "TBD" instead of its date.
  const showTimes = switches.showTimes;
  const deadlineText = (d: Date) => (showTimes ? formatDeadline(d) : TBD);
  const left = Math.max(0, s.capacity - s.enrolled);
  // The explicit hero, or the first photo when none was set, as in the app.
  const photos = photoSet?.sessionId === s.id ? photoSet.photos : [];
  const { hero, gallery } = splitHero(s.heroImageUrl, photos);
  // Participating is capped (summit_settings.max_participating); spectating
  // is not. The server refuses it too (participation_cap.sql).
  const participatingCap = switches.maxParticipating;
  const atParticipatingCap = participatingCap != null && schedule.mySchedule.length >= participatingCap;
  // More open sessions in this discipline; while time conflicts are on, only
  // ones that fit an open slot on their day.
  const suggested = signedIn
    ? suggestedSessions(s, MOCK_SESSIONS, new Set([
      ...schedule.mySchedule, ...schedule.expertSchedule, ...schedule.spectating, ...schedule.volunteerSchedule,
    ]), switches.scheduleConflictsOn)
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
        if (result.teamCode) setNewTeamCode({ code: result.teamCode, name: result.projectName || (extra?.project && 'projectName' in extra.project ? extra.project.projectName ?? '' : '') });
        break;
      case 'removed':
        await afterChange();
        break;
      case 'invalid_project':
        setBlocked({ title: "Couldn't register", body: result.message });
        break;
      case 'limit_reached':
        setBlocked({ title: 'Participation limit reached', body: result.message });
        break;
      case 'full':
        setBlocked({ title: 'Track full', body: `This track has reached its capacity of ${s.capacity}. You can still join the waitlist on the day.` });
        break;
      case 'conflict':
        setBlocked({ title: 'Time conflict', body: conflictMessage(result.conflictKind, result.conflictingTitle, role) });
        break;
      case 'participation_closed':
        setBlocked({
          title: 'Participant registration closed',
          body: `Registration to participate closed${deadline && showTimes ? ` on ${formatDeadline(deadline)}` : ''}. You can still add this track as a spectator while seats are left.`,
        });
        break;
    }
  };

  const setManage = async (manage: boolean) => {
    const result = await guarded(() => setSessionManage(s.id, manage));
    if (!result) return;
    if (result.outcome === 'conflict') {
      // Managing wins: show what it would take off the admin's day
      // (volunteer_conflict_override.sql). Without it, the old refusal.
      const items = auth ? await previewManagerAssignment(s.id, auth.user.id) : null;
      if (items && items.length > 0) {
        setReplacing({ personName: null, sessionTitle: s.title, items });
        return;
      }
      setBlocked({
        title: 'Time conflict',
        body: result.conflictKind === 'registered_this'
          ? "You're signed up for this track. Remove it from your day first to manage it."
          : `Managing this overlaps with "${result.conflictingTitle ?? 'another track'}", which is already on your schedule.`,
      });
      return;
    }
    await afterChange();
    toast.success(manage ? `You're now managing "${s.title}"` : `Stopped managing "${s.title}"`);
  };

  const manageInstead = async () => {
    if (!auth) return;
    const done = await guarded(() => assignManagerReplacingConflicts(s.id, auth.user.id));
    setReplacing(null);
    if (!done) return;
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
    if (mode === 'participate') {
      // At the cap: say so before any questions. Spectating is still open.
      if (atParticipatingCap) {
        return setBlocked({ title: 'Participation limit reached', body: participationLimitMessage(participatingCap) });
      }
      // A track that asks nothing registers straight away. One that only
      // skips the project name and allows no teams registers them solo.
      if (s.askQuestions === false) return register('participant');
      if (!registrationAsksAnything(s)) return register('participant', { project: { action: 'solo', projectName: '' }, answers: {} });
      return setForm({ editing: false, answers: {} });
    }
    if (mode === 'expert') return setExpertConfirm(true);
    await register(TYPE_FOR[mode]);
  };

  // Saves the LinkedIn answer (only when it changed), then signs them up.
  const serveAsExpert = async (answers: Record<string, string>) => {
    const next = linkedInAnswers(answers);
    const details = (profile?.details ?? {}) as Record<string, unknown>;
    const changed = [LINKEDIN_VISIBLE_KEY, LINKEDIN_URL_KEY].some((k) => String(details[k] ?? '') !== next[k]);
    if (changed) {
      setSavingLinkedIn(true);
      try {
        await saveExpertLinkedIn(next);
        await refreshProfile?.();
      } catch {
        toast.error("Couldn't save your LinkedIn choice. Try again.");
        return;
      } finally {
        setSavingLinkedIn(false);
      }
    }
    setExpertConfirm(false);
    await register('expert');
  };

  const removeFromDay = async () => {
    let newOwnerId: string | undefined;
    if (registeredType === 'participant') {
      const handOff = await handOffIfNeeded('remove this track');
      if (!handOff.proceed) return;
      newOwnerId = handOff.newOwnerId;
    }
    const result = await guarded(() => toggleRegistration(s.id, { add: false, newOwnerId }));
    if (!result) return;
    if (result.outcome === 'invalid_project') {
      setBlocked({ title: "Couldn't remove this track", body: result.message });
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
        <p className="flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: accent }} />
          {left === 0 ? `Full (${s.enrolled}/${s.capacity})` : `${left} of ${s.capacity} seats left`}
        </p>
        {/* An 8th-grade participant sees whether they can participate. */}
        {eighthGrade && (s.allowEighthGraders
          ? <p><EighthGradeBadge color={accent} /></p>
          : (
            <p className="flex items-center gap-2">
              <Info className="h-4 w-4" style={{ color: accent }} />
              Not open to 8th graders for participating. You can spectate it.
            </p>
          ))}
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
        <h2 className="mb-2 font-semibold">About this track</h2>
        <p className="whitespace-pre-line leading-relaxed">{s.description}</p>
      </section>
      {(s.pageBlocks ?? []).filter((b) => b.title.trim() || b.body.trim()).map((b, i) => (
        <section key={i}>
          {b.title.trim() && <h2 className="mb-2 font-semibold">{b.title}</h2>}
          {b.body.trim() && <p className="whitespace-pre-line leading-relaxed">{b.body}</p>}
        </section>
      ))}
      <SessionExperts experts={experts} accent={accent} />
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

      <div className="space-y-3">
        {!signedIn ? (
          auth == null ? (
            <Button asChild className="bg-emerald text-white hover:bg-emerald-deep"><Link to="/roles">Sign in to add this to your day</Link></Button>
          ) : null
        ) : waitingExpert ? (
          <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm">An organizer has to approve your expert account before you can add tracks.</p>
        ) : managing ? (
          <div className="space-y-3 rounded-2xl bg-emerald/10 p-4 text-sm">
            <p>{role === 'admin' ? "You're managing this track." : "You're managing this track. It was added to your schedule by an organizer."}</p>
            {role === 'admin' && <Button variant="outline" size="sm" disabled={busy} onClick={() => void setManage(false)}>Stop managing</Button>}
          </div>
        ) : registeredType ? (
          <>
            <p className="rounded-2xl bg-secondary px-4 py-3 text-sm">{STATUS_LABEL[registeredType]}</p>
            {registeredType === 'participant' && (
              <>
                {projectLoaded && (project != null || s.askQuestions !== false) && (
                  <ProjectCard
                    project={project}
                    onLeave={() => setLeaving({ name: project?.projectName ?? '', error: null })}
                    onTransfer={() => void transfer()}
                    onRemoveMember={setRemoving}
                  />
                )}
                {registrationAsksAnything(s, project?.isTeam ?? false) && (
                  <Button variant="outline" onClick={() => void editRegistration()}>
                    <Pencil className="h-4 w-4" /> {projectLoaded && project == null ? 'Add my project details' : 'Edit my registration'}
                  </Button>
                )}
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
          <Button variant="outline" onClick={() => setEditorOpen(true)}><Pencil className="h-4 w-4" /> Edit track page</Button>
        )}
        {schedule.scheduleError && signedIn && (
          <p role="alert" className="text-sm text-destructive">We could not load your saved schedule. Refresh the page to retry.</p>
        )}
      </div>

      {suggested.length > 0 && (
        <section className="border-t border-border pt-6">
          <h2 className="font-semibold">Tracks similar to this</h2>
          <p className="mt-1 text-xs text-muted-foreground">More in {disciplineLabel || 'this discipline'} that fit an open slot on your schedule.</p>
          <div className="-mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {suggested.map((x) => (
              <SuggestedSessionCard
                key={x.id}
                session={x}
                time={timeLabel(x, showTimes)}
                onOpen={() => onOpenSession(x.id)}
                onAdd={() => onOpenSession(x.id, { add: true })}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">{s.title}</h1>
        <div className="mt-4 h-1 w-16 rounded-full" style={{ background: rgba(accent, 0.8) }} />
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
            <SessionRoster session={s} types={['participant', 'spectator']} canMarkAttendance={canMarkAttendance} emptyMessage="No participants have registered for this track yet." />
          </TabsContent>
          <TabsContent value="experts">
            <SessionRoster session={s} types={['expert']} canMarkAttendance={canMarkAttendance} emptyMessage="No experts have registered for this track yet." />
          </TabsContent>
          <TabsContent value="volunteers"><SessionVolunteers session={s} canAssign={role === 'admin'} /></TabsContent>
          <TabsContent value="metrics"><SessionMetrics session={s} /></TabsContent>
        </Tabs>
      ) : about}

      {/* Add to my day: the role's choices, like the app's bottom sheet. */}
      <ExpertTrackDialog
        open={expertConfirm}
        trackTitle={s.title}
        saved={profile?.details as Record<string, unknown> | null | undefined}
        busy={savingLinkedIn || busy}
        onCancel={() => setExpertConfirm(false)}
        onConfirm={(answers) => void serveAsExpert(answers)}
      />
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
                To manage this session, an organizer has to assign you. You'll be notified if they do.
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
          <DialogFooter><Button onClick={() => setBlocked(null)}>Got it</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ReplaceScheduleDialog request={replacing} busy={busy} onConfirm={() => void manageInstead()} onCancel={() => setReplacing(null)} />

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
            <DialogDescription>You'll stay registered for this track as a solo participant.</DialogDescription>
          </DialogHeader>
          {asksProjectName && (
            <div className="space-y-2">
              <Label htmlFor="solo-name">{projectPromptOf(s)}</Label>
              <Input id="solo-name" value={leaving?.name ?? ''} onChange={(e) => setLeaving((l) => l && { ...l, name: e.target.value, error: null })} />
              {leaving?.error && <p className="text-sm text-destructive">{leaving.error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaving(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const name = asksProjectName ? leaving?.name.trim() ?? '' : '';
                if (asksProjectName && !name) setLeaving((l) => l && { ...l, error: 'Please answer this to go solo.' });
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
              They'll be taken off your team but stay registered for this track, and they'll be notified. They won't be able to rejoin your team with its code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => removing && void removeMember(removing)}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

