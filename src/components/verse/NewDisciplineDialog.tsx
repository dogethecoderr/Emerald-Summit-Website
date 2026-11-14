// "New discipline", the app's discipline_editor_screen.dart: admins add a
// discipline with an id, name, tagline and icon. RLS lets only admins insert;
// nobody can delete one through the API (the app repo's
// discipline_delete_dashboard_only.sql), so there is no delete here either.
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DISCIPLINE_ICONS, Loader2, Plus } from '@/components/icons';
import { DISCIPLINE_ICON_KEYS } from '../../models/disciplines';
import { createDiscipline } from '../../services/summitContent';

const SLUG = /^[a-z0-9_]+$/;

export default function NewDisciplineDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [icon, setIcon] = useState('category');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setId(''); setName(''); setTagline(''); setIcon('category'); setError(null); setBusy(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const slug = id.trim().toLowerCase();
    if (!SLUG.test(slug)) return setError('Id must be lowercase letters, numbers, or _.');
    if (!name.trim()) return setError('Name is required.');
    setBusy(true);
    setError(null);
    try {
      await createDiscipline({ id: slug, name: name.trim(), tagline: tagline.trim(), icon });
      toast.success('Discipline created');
      reset();
      onOpenChange(false);
    } catch {
      setBusy(false);
      setError('Could not create. The id may already be taken.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display">New discipline</DialogTitle>
            <DialogDescription>It shows up on Discover for everyone, in the app too.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="nd-id">Id (slug)</Label>
            <Input id="nd-id" placeholder="e.g. civicverse" value={id} disabled={busy} onChange={(e) => setId(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nd-name">Name</Label>
            <Input id="nd-name" placeholder="e.g. CivicVerse" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nd-tagline">Tagline</Label>
            <Input id="nd-tagline" placeholder="e.g. Government & society" value={tagline} disabled={busy} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nd-icon">Icon</Label>
            <Select value={icon} onValueChange={setIcon} disabled={busy}>
              <SelectTrigger id="nd-icon"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISCIPLINE_ICON_KEYS.map((k) => {
                  const Icon = DISCIPLINE_ICONS[k];
                  return (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2.5"><Icon className="h-5 w-5 text-emerald" /> {k}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full bg-emerald-deep text-white hover:bg-emerald">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create discipline
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
