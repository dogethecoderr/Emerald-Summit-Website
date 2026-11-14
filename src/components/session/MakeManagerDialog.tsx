// Shown when an admin makes a volunteer who's signed up for this session its
// manager. Managing replaces taking part, so their sign-up comes off the
// roster (and anything else at the same time comes off their day too), all in
// one call: assign_manager_replacing_conflicts (volunteer_conflict_override.sql).
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { describeReplacement, describeTeamEffect, type ReplacedItem } from '../../services/organizer';
import type { ParticipationType } from '../../models/registration';

export interface MakeManagerRequest {
  personName: string;
  type: ParticipationType;
  /** From preview_manager_assignment: this sign-up plus any clashes elsewhere. */
  items: ReplacedItem[];
}

const AS: Record<ParticipationType, string> = {
  participant: 'a participant',
  spectator: 'a spectator',
  expert: 'an expert',
};

export default function MakeManagerDialog({ request, busy, onConfirm, onCancel }: {
  request: MakeManagerRequest | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const here = request?.items.find((i) => i.kind === 'registered_this');
  const team = here ? describeTeamEffect(here, 'they') : null;
  const elsewhere = request?.items.filter((i) => i.kind !== 'registered_this') ?? [];
  return (
    <Dialog open={request != null} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Make {request?.personName} a manager?</DialogTitle>
          <DialogDescription>
            This will make them a manager of this session, and they will no longer be
            {' '}{AS[request?.type ?? 'participant']} of this session.
          </DialogDescription>
        </DialogHeader>
        {team && <p className="text-sm">{team}</p>}
        {elsewhere.length > 0 && (
          <div className="space-y-2 text-sm">
            <p>It also takes these off their day, since they overlap:</p>
            <ul className="list-disc space-y-2 pl-5">
              {elsewhere.map((item) => <li key={`${item.kind}-${item.sessionId}`}>{describeReplacement(item, 'they')}</li>)}
            </ul>
          </div>
        )}
        <p className="text-sm text-muted-foreground">They'll get a notice about the change.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={busy} onClick={onConfirm} className="bg-emerald text-white hover:bg-emerald-deep">
            Make manager
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
