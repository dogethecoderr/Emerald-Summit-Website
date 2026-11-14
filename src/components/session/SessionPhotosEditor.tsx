// The session editor's hero photo and gallery, ported from the app's
// session_editor_screen.dart (_heroPicker and _galleryEditor). Uploads and
// deletes happen right away, as in the app; the hero choice is saved with
// the rest of the form.
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ImageIcon, Info, Loader2, Plus, X } from '@/components/icons';
import {
  deleteSessionPhoto,
  fetchSessionPhotos,
  SESSION_PHOTO_TYPES,
  uploadSessionPhoto,
  type SessionPhoto,
} from '../../services/sessionPhotos';

const UPLOAD_FAILED = 'Could not upload. You may not manage this session.';

export default function SessionPhotosEditor({
  sessionId,
  hero,
  onHeroChange,
  onBusyChange,
}: {
  /** Undefined for a session that hasn't been saved yet. */
  sessionId?: string;
  hero: string | null;
  onHeroChange: (url: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [photos, setPhotos] = useState<SessionPhoto[]>([]);
  const [busy, setBusyState] = useState(false);
  const heroInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const setBusy = (b: boolean) => {
    setBusyState(b);
    onBusyChange?.(b);
  };

  useEffect(() => {
    if (!sessionId) return;
    let live = true;
    fetchSessionPhotos(sessionId).then((list) => { if (live) setPhotos(list); });
    return () => { live = false; };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-3 text-xs">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p>Save the session first, then reopen it to add photos.</p>
      </div>
    );
  }

  const upload = async (file: File | undefined, asHero: boolean) => {
    if (!file) return;
    setBusy(true);
    try {
      const photo = await uploadSessionPhoto(sessionId, file);
      setPhotos((list) => [...list, photo]);
      if (asHero) onHeroChange(photo.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(/isn't a photo|larger than/.test(msg) ? msg : UPLOAD_FAILED);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photo: SessionPhoto) => {
    setBusy(true);
    try {
      await deleteSessionPhoto(sessionId, photo.name);
      setPhotos((list) => list.filter((p) => p.name !== photo.name));
    } catch {
      toast.error('Could not delete the photo.');
    } finally {
      setBusy(false);
    }
  };

  // The hero file also lives in the folder; don't list it twice.
  const gallery = photos.filter((p) => p.url !== hero);
  const accept = SESSION_PHOTO_TYPES.join(',');
  const pick = (input: HTMLInputElement | null) => input?.click();

  return (
    <div className="space-y-4">
      <input
        ref={heroInput}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => { void upload(e.target.files?.[0], true); e.target.value = ''; }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => { void upload(e.target.files?.[0], false); e.target.value = ''; }}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium">Hero photo</p>
        {hero && (
          <img src={hero} alt="" width={1200} height={675} className="aspect-video w-full rounded-xl bg-muted object-cover" />
        )}
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => pick(heroInput.current)}>
          <ImageIcon className="h-4 w-4" /> {hero ? 'Replace' : 'Set hero photo'}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Gallery</p>
        <ul className="flex flex-wrap gap-2">
          {gallery.map((p) => (
            <li key={p.name} className="relative">
              <img src={p.url} alt="" width={96} height={96} loading="lazy" className="h-24 w-24 rounded-lg bg-muted object-cover" />
              <button
                type="button"
                aria-label="Remove"
                title="Remove"
                disabled={busy}
                onClick={() => void remove(p)}
                className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-white shadow disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-label="Add a photo"
              disabled={busy}
              onClick={() => pick(galleryInput.current)}
              className="grid h-24 w-24 place-items-center rounded-lg border border-border text-emerald hover:bg-muted/60 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
