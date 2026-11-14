// "Report a bug" and "Send feedback", opened from their own rows on Profile.
// They're two categories of ticket (bug_reports.kind); the switch at the top
// moves a ticket between them before it's sent. Name and description are
// required; screenshots (picked, dropped or pasted) and an emailed copy
// are optional. Everything else in the report is attached automatically
// (src/services/bugReports.ts), and the form says what.
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Bug, CheckCircle2, ChevronDown, ImageIcon, MessageSquare, X } from '@/components/icons';
import { cn } from '@/lib/utils';
import {
  MAX_DESCRIPTION, MAX_NAME, MAX_SCREENSHOTS, reportErrorMessage, screenshotProblem, submitReport,
  type ReportKind, type SubmitResult,
} from '../services/bugReports';

interface Shot { file: File; url: string }

const ATTACHED = [
  'Your sign-in email, role, school and grade',
  'The sessions on your day, any team, sessions you manage, and your check-in',
  'Your last 10 notifications',
  'The pages you opened on this site before reporting, and any errors they showed',
  'Your browser, screen size, theme and the version of the site',
];

export default function ReportDialog({ open, onOpenChange, kind: initialKind = 'bug', defaultName, email }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which row opened it: a bug report or feedback. */
  kind?: ReportKind;
  defaultName: string;
  email: string;
}) {
  const [kind, setKind] = useState<ReportKind>(initialKind);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const [emailCopy, setEmailCopy] = useState(true);
  const [showAttached, setShowAttached] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  useEffect(() => { if (!name) setName(defaultName); }, [defaultName]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setKind(initialKind); }, [open, initialKind]);
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const addFiles = (files: File[]) => {
    setProblem(null);
    const room = MAX_SCREENSHOTS - shots.length;
    if (room <= 0) {
      setProblem(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
      return;
    }
    const ok: Shot[] = [];
    for (const file of files) {
      const reason = screenshotProblem(file);
      if (reason) {
        setProblem(reason);
        continue;
      }
      if (ok.length < room) ok.push({ file, url: URL.createObjectURL(file) });
      else setProblem(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
    }
    setShots((s) => [...s, ...ok]);
  };

  const removeShot = (i: number) => {
    setShots((s) => {
      URL.revokeObjectURL(s[i].url);
      return s.filter((_, j) => j !== i);
    });
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles([...e.dataTransfer.files]);
  };

  const reset = () => {
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
    setDescription('');
    setProblem(null);
    setResult(null);
    setShowAttached(false);
  };

  const close = (next: boolean) => {
    if (sending) return;
    onOpenChange(next);
    // A sent report is done; an unsent draft stays until it's sent.
    if (!next && result) reset();
  };

  const send = async () => {
    if (!name.trim()) return setProblem('Please add your name.');
    if (!description.trim()) return setProblem(kind === 'bug' ? 'Please describe the bug.' : 'Please write your feedback.');
    setProblem(null);
    setSending(true);
    try {
      setResult(await submitReport({ kind, name, description, screenshots: shots.map((s) => s.file), emailCopy }));
    } catch (error) {
      setProblem(reportErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl" onPaste={result ? undefined : onPaste}>
        {result ? (
          <div className="space-y-4 py-2 text-center" role="status">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald" />
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle>{kind === 'bug' ? 'Thanks, we got your bug report' : 'Thanks for the feedback'}</DialogTitle>
              <DialogDescription>Your ticket is {kind === 'bug' ? 'Bug' : 'Feedback'} #{result.ticketNo}.</DialogDescription>
            </DialogHeader>
            {result.emailed === true && <p className="text-sm text-muted-foreground">We emailed a copy to {email}, with everything that was sent.</p>}
            {result.emailed === false && <p className="text-sm text-muted-foreground">Your report was saved, but we couldn't email your copy.</p>}
            <Button onClick={() => close(false)}>Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{kind === 'bug' ? 'Report a bug' : 'Send feedback'}</DialogTitle>
              <DialogDescription>
                {kind === 'bug'
                  ? "Tell us what happened. We'll attach the details we need to fix it."
                  : 'Tell us what works, what doesn\'t, or what you\'d add.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Category">
              {([['bug', 'Bug report', Bug], ['feedback', 'Feedback', MessageSquare]] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => setKind(value)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors',
                    kind === value ? 'border-emerald bg-emerald/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/50',
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-name">Your name</Label>
              <Input id="report-name" autoComplete="name" maxLength={MAX_NAME} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-description">{kind === 'bug' ? 'What went wrong?' : 'Your feedback'}</Label>
              <Textarea
                id="report-description"
                required
                rows={6}
                maxLength={MAX_DESCRIPTION}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={kind === 'bug'
                  ? 'What were you doing, what happened, and what did you expect to happen?'
                  : 'What would make the Summit site better?'}
              />
              {description.length > MAX_DESCRIPTION - 500 && (
                <p className="text-right text-xs text-muted-foreground">{description.length} / {MAX_DESCRIPTION}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Screenshots <span className="font-normal text-muted-foreground">(optional, up to {MAX_SCREENSHOTS})</span></Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn('rounded-xl border border-dashed p-3 transition-colors', dragging ? 'border-emerald bg-emerald/5' : 'border-border')}
              >
                {shots.length > 0 && (
                  <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {shots.map((s, i) => (
                      <li key={s.url} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary">
                        <img src={s.url} alt={`Screenshot ${i + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeShot(i)}
                          aria-label={`Remove screenshot ${i + 1}`}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={shots.length >= MAX_SCREENSHOTS}>
                    <ImageIcon className="h-4 w-4" /> Add screenshots
                  </Button>
                  <span className="text-xs text-muted-foreground">or drop or paste them here</span>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  data-testid="report-file-input"
                  onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-secondary/40">
              <button
                type="button"
                onClick={() => setShowAttached((v) => !v)}
                aria-expanded={showAttached}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium"
              >
                What else is sent with your report
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', showAttached && 'rotate-180')} />
              </button>
              {showAttached && (
                <div className="space-y-2 px-3 pb-3 text-[13px] text-muted-foreground">
                  <ul className="list-disc space-y-1 pl-5">
                    {ATTACHED.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  <p>Not your phone number or student ID. Only the Summit's admins can read reports.</p>
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox checked={emailCopy} onCheckedChange={(v) => setEmailCopy(v === true)} className="mt-0.5" aria-label="Email me a copy" />
              <span>
                <span className="font-medium">Email me a copy</span>
                <span className="block text-[13px] text-muted-foreground">To {email}, including everything listed above.</span>
              </span>
            </label>

            {problem && <p role="alert" className="text-sm font-medium text-red-500">{problem}</p>}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={sending}>Cancel</Button>
              <Button type="button" onClick={send} disabled={sending} className="bg-emerald text-white hover:bg-emerald-deep">
                {sending ? 'Sending…' : kind === 'bug' ? 'Send bug report' : 'Send feedback'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
