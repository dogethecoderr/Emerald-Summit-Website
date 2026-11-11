// Signed in and picking another role: preview what the switch does to your
// sessions, then confirm. Same steps and words as the app's Change role.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Loader2 } from '@/components/icons';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { roleLabelFor, type RoleInfo } from '../models/roles';
import {
  changeRole,
  checkRoleEligible,
  describeRoleChange,
  previewRoleChange,
  roleChangeLeadIn,
  type RoleChangeItem,
} from '../services/roleChange';
import { Button } from '@/components/ui/button';

export default function ChangeRolePanel({ role }: { role: RoleInfo }) {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [changes, setChanges] = useState<RoleChangeItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = roleLabelFor(profile?.role as string | undefined, profile?.volunteer_subtype);

  const preview = async () => {
    setBusy(true);
    setError(null);
    try {
      await checkRoleEligible(role.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
      return;
    }
    try {
      setChanges(await previewRoleChange(role.name));
    } catch {
      // The app goes ahead with no list when the preview can't load.
      setChanges([]);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const kept = await changeRole(role.name);
      await refreshProfile();
      toast.success(`You’re now a ${roleLabelFor(kept.role, kept.volunteer_subtype)}.`);
      // Like the app, the new role's sign-up questions come next.
      navigate('/profile', { replace: true, state: { roleChanged: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card px-4 py-4 text-[13px]">
      <p className="text-muted-foreground">
        You're signed in as <span className="font-semibold text-foreground">{current}</span>.
      </p>
      {changes === null ? (
        <Button type="button" onClick={preview} disabled={busy} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
          Change role to {role.label}
        </Button>
      ) : (
        <>
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="font-semibold">Switching to {role.label}</div>
            {role.name === 'expert' && (
              <p className="mt-2">
                Expert accounts need an admin to approve them. Until then, you'll only see a screen
                saying your account is awaiting approval.
              </p>
            )}
            {changes.length > 0 && (
              <>
                <p className="mt-2">{roleChangeLeadIn(role.name, role.label)}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {changes.map((c) => <li key={c.sessionId}>{describeRoleChange(c)}</li>)}
                </ul>
                {changes.some((c) => c.from === 'managing') && (
                  <p className="mt-2">
                    The admins will be told you're no longer managing these sessions, so they can find someone else.
                  </p>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={confirm} disabled={busy} className="flex-1 gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setChanges(null)}>Cancel</Button>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  );
}
