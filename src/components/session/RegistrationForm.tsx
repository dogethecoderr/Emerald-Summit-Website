// The participant registration form, ported from the app's
// session_registration_screen.dart. Always asks the built-in project question
// (solo with a project name, or a team: create one and get a code, or join a
// teammate's by code after confirming its project), then the session's own
// questions. Editing an existing registration prefills it, and a team member
// can stay on their team.
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Session } from '../../models/sessions';
import {
  DEFAULT_MAX_TEAM_SIZE,
  DEFAULT_QUESTIONS,
  mustHandOff,
  normalizeTeamCode,
  teamCodePrefix,
  teamLookupProblem,
  teamsAllowed,
  type MyProject,
  type ProjectChoice,
} from '../../models/registration';
import { findTeam } from '../../services/sessionRegistration';

export interface RegistrationFormResult {
  project: ProjectChoice;
  answers: Record<string, string>;
}

type TeamAction = 'createTeam' | 'joinTeam' | 'stayOnTeam';

export function projectPromptOf(session: Session): string {
  return session.customProjectPrompt || DEFAULT_QUESTIONS.projectName;
}

export default function RegistrationForm({
  open,
  session,
  editing = false,
  initialProject = null,
  initialAnswers = {},
  onCancel,
  onSubmit,
}: {
  open: boolean;
  session: Session;
  editing?: boolean;
  initialProject?: MyProject | null;
  initialAnswers?: Record<string, string>;
  onCancel: () => void;
  onSubmit: (result: RegistrationFormResult) => void;
}) {
  const maxTeamSize = session.maxTeamSize ?? DEFAULT_MAX_TEAM_SIZE;
  const soloOnly = !teamsAllowed(maxTeamSize);
  const onTeamNow = initialProject?.isTeam ?? false;
  // Solo-only sessions skip the question, unless they're already on a team.
  const askSoloOrTeam = !soloOnly || onTeamNow;
  const prompt = projectPromptOf(session);
  const questions = session.questions ?? [];

  const [isTeam, setIsTeam] = useState<boolean | null>(initialProject ? initialProject.isTeam : soloOnly ? false : null);
  const [teamAction, setTeamAction] = useState<TeamAction | null>(onTeamNow ? 'stayOnTeam' : null);
  const [soloName, setSoloName] = useState(initialProject && !initialProject.isTeam ? initialProject.projectName : '');
  const [newTeamName, setNewTeamName] = useState('');
  const [stayName, setStayName] = useState(onTeamNow ? initialProject!.projectName : '');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [pendingTeam, setPendingTeam] = useState<{ code: string; projectName: string; memberCount: number } | null>(null);
  const [confirmedTeam, setConfirmedTeam] = useState<{ code: string; projectName: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(questions.map((q) => [q.id, initialAnswers[q.id] ?? ''])),
  );
  const [error, setError] = useState<string | null>(null);

  const willHandOff = (() => {
    const p = initialProject;
    if (!mustHandOff(p) || isTeam == null) return false;
    if (isTeam === false) return true;
    if (teamAction === 'createTeam') return true;
    if (teamAction === 'joinTeam') return confirmedTeam != null && confirmedTeam.code !== p!.teamCode;
    return false;
  })();

  const projectMissing = session.customProjectPrompt
    ? `Please answer "${prompt}"`
    : 'Please enter your project name.';

  const lookUp = async () => {
    const normalized = normalizeTeamCode(code);
    if (!normalized) {
      setCodeError('Enter the code your teammate shared.');
      return;
    }
    setLookingUp(true);
    setCodeError(null);
    try {
      const lookup = await findTeam(session.id, normalized);
      const problem = teamLookupProblem(lookup);
      if (problem) setCodeError(problem);
      else setPendingTeam({ code: normalized, projectName: lookup.projectName ?? '', memberCount: lookup.memberCount });
    } catch {
      setCodeError("Couldn't check that code. Try again.");
    } finally {
      setLookingUp(false);
    }
  };

  const submit = () => {
    setError(null);
    let project: ProjectChoice;
    if (isTeam == null) return setError("Choose whether you're participating solo or as a team.");
    if (!isTeam) {
      if (!soloName.trim()) return setError(projectMissing);
      project = { action: 'solo', projectName: soloName.trim() };
    } else if (teamAction === 'createTeam') {
      if (!newTeamName.trim()) return setError(projectMissing);
      project = { action: 'createTeam', projectName: newTeamName.trim() };
    } else if (teamAction === 'joinTeam') {
      if (!confirmedTeam) return setError('Enter your team code and select "Find team" to confirm it.');
      project = { action: 'joinTeam', teamCode: confirmedTeam.code };
    } else if (teamAction === 'stayOnTeam') {
      project = { action: 'stayOnTeam', projectName: stayName.trim() || undefined };
    } else {
      return setError('Create a team or join one with a code.');
    }
    const out: Record<string, string> = {};
    for (const q of questions) {
      const text = (answers[q.id] ?? '').trim();
      if (!text) return setError('Please answer every question.');
      out[q.id] = text;
    }
    onSubmit({ project, answers: out });
  };

  const segment = (active: boolean) =>
    cn(
      'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
      active ? 'bg-emerald text-white' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
    );

  const projectField = (id: string, value: string, set: (v: string) => void, helper?: string) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold">{prompt}</Label>
      <Input id={id} value={value} placeholder="Your answer" onChange={(e) => set(e.target.value)} />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit my registration' : 'Register'}</DialogTitle>
          <DialogDescription>{session.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {!askSoloOrTeam ? (
            <Note>This session is solo only. Every participant works on their own project.</Note>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold">{DEFAULT_QUESTIONS.soloOrTeam}</p>
              <div role="radiogroup" aria-label="Solo or team" className="flex gap-1 rounded-xl border border-border p-1">
                <button type="button" role="radio" aria-checked={isTeam === false} className={segment(isTeam === false)} onClick={() => setIsTeam(false)}>Solo</button>
                <button type="button" role="radio" aria-checked={isTeam === true} className={segment(isTeam === true)} onClick={() => setIsTeam(true)}>Team</button>
              </div>
              <Note>
                {soloOnly
                  ? "This session is now solo only. You can stay on your team or go solo, but teams can't be created or joined."
                  : DEFAULT_QUESTIONS.unsureNote}
              </Note>
            </div>
          )}

          {isTeam === false && projectField('solo-project', soloName, setSoloName)}

          {isTeam === true && (
            <div className="space-y-4">
              <div role="radiogroup" aria-label="Team" className="flex gap-1 rounded-xl border border-border p-1">
                {onTeamNow && (
                  <button type="button" role="radio" aria-checked={teamAction === 'stayOnTeam'} className={segment(teamAction === 'stayOnTeam')} onClick={() => setTeamAction('stayOnTeam')}>My team</button>
                )}
                {!soloOnly && (
                  <>
                    <button type="button" role="radio" aria-checked={teamAction === 'createTeam'} className={segment(teamAction === 'createTeam')} onClick={() => setTeamAction('createTeam')}>Create</button>
                    <button type="button" role="radio" aria-checked={teamAction === 'joinTeam'} className={segment(teamAction === 'joinTeam')} onClick={() => setTeamAction('joinTeam')}>Join</button>
                  </>
                )}
              </div>

              {teamAction == null && (
                <p className="text-sm text-muted-foreground">
                  Starting a team? Create it and share the code. Have a code from a teammate? Join their team.
                </p>
              )}

              {teamAction === 'stayOnTeam' && (
                <div className="space-y-2">
                  {projectField('stay-project', stayName, setStayName, 'Changing this changes it for your whole team.')}
                  {initialProject?.teamCode && <p className="text-sm">Team code: {initialProject.teamCode}</p>}
                </div>
              )}

              {teamAction === 'createTeam' && projectField(
                'team-project',
                newTeamName,
                setNewTeamName,
                `You'll get a team code (like ${teamCodePrefix(session.track, session.disciplineName ?? '')}1234) to share with your teammates. They enter it when they register for this session. Teams here can have up to ${maxTeamSize} members, and you'll be the team's owner.`,
              )}

              {teamAction === 'joinTeam' && (confirmedTeam ? (
                <div className="flex items-center gap-3 rounded-xl bg-emerald/10 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{confirmedTeam.projectName}</p>
                    <p className="text-xs text-muted-foreground">Joining team {confirmedTeam.code}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmedTeam(null)}>Change</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="team-code" className="text-sm font-semibold">{DEFAULT_QUESTIONS.teamCode}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="team-code"
                      value={code}
                      autoCapitalize="characters"
                      placeholder={`e.g. ${teamCodePrefix(session.track, session.disciplineName ?? '')}1234`}
                      aria-invalid={codeError != null}
                      aria-describedby={codeError ? 'team-code-error' : undefined}
                      onChange={(e) => setCode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void lookUp(); } }}
                    />
                    <Button type="button" variant="outline" disabled={lookingUp} onClick={() => void lookUp()}>
                      {lookingUp ? 'Checking…' : 'Find team'}
                    </Button>
                  </div>
                  {codeError && <p id="team-code-error" className="text-sm text-destructive">{codeError}</p>}
                </div>
              ))}
            </div>
          )}

          {willHandOff && (
            <Note>You own "{initialProject!.projectName}". After you save, you'll pick the teammate who takes it over.</Note>
          )}

          {questions.length > 0 && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold">A few more questions</p>
                <p className="text-xs text-muted-foreground">The session organizers ask participants to share this.</p>
              </div>
              {questions.map((q) => (
                <div key={q.id} className="space-y-1.5">
                  <Label htmlFor={`q-${q.id}`}>{q.prompt}</Label>
                  <Textarea
                    id={`q-${q.id}`}
                    rows={2}
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" disabled={lookingUp} onClick={submit} className="bg-emerald text-white hover:bg-emerald-deep">
            {editing ? 'Save changes' : 'Confirm and add'}
          </Button>
        </DialogFooter>

        <Dialog open={pendingTeam != null} onOpenChange={(o) => !o && setPendingTeam(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm your team</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 text-sm">
                  {session.customProjectPrompt ? (
                    <p>Is this your team?<br />{prompt}<br /><strong>"{pendingTeam?.projectName}"</strong></p>
                  ) : (
                    <p>Is your project name <strong>"{pendingTeam?.projectName}"</strong>?</p>
                  )}
                  {(pendingTeam?.memberCount ?? 0) > 0 && (
                    <p>Team {pendingTeam!.code} already has {pendingTeam!.memberCount} member{pendingTeam!.memberCount === 1 ? '' : 's'}.</p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPendingTeam(null);
                  setCodeError('Double-check the code with your teammate and try again.');
                }}
              >No</Button>
              <Button
                type="button"
                className="bg-emerald text-white hover:bg-emerald-deep"
                onClick={() => {
                  setConfirmedTeam({ code: pendingTeam!.code, projectName: pendingTeam!.projectName });
                  setPendingTeam(null);
                }}
              >Yes, that's us</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{children}</p>;
}
