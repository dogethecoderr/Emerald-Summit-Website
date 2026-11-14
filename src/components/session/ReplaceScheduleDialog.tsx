// Shown before an admin assigns someone (or themselves) to manage a session
// they're already busy for. A person does one thing at a time, so managing
// wins and everything listed comes off their day (volunteer_conflict_override.sql).
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { describeReplacement, type ReplacedItem } from '../../services/organizer';

export interface ReplaceRequest {
  /** Null when the admin is managing it themselves. */
  personName: string | null;
  sessionTitle: string;
  items: ReplacedItem[];
}

export default function ReplaceScheduleDialog({ request, busy, onConfirm, onCancel }: {
  request: ReplaceRequest | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const self = request?.personName == null;
  const who = self ? 'you' : 'they';
  return (
    <Dialog open={request != null} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{self ? 'Replace what you’re doing?' : 'Replace what they’re doing?'}</DialogTitle>
          <DialogDescription>
            {self ? 'You' : request?.personName} can only do one thing at a time. Managing "{request?.sessionTitle}"
            {' '}takes {self ? 'these off your day' : 'these off their day'}:
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {request?.items.map((item) => <li key={`${item.kind}-${item.sessionId}`}>{describeReplacement(item, who)}</li>)}
        </ul>
        {!self && (
          <p className="text-sm text-muted-foreground">They'll get a notice listing these changes.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={busy} onClick={onConfirm} className="bg-emerald text-white hover:bg-emerald-deep">
            {self ? 'Manage instead' : 'Assign and replace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
