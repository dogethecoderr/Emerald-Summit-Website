// One card in "Sessions similar to this", like the app's _SuggestedSessionCard:
// the session's hero (or its first photo), title, time and seats left, and an
// Add button that opens that session's Add to my day.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ImageIcon, Plus } from '@/components/icons';
import type { Session } from '../../models/sessions';
import { fetchSessionPhotos } from '../../services/sessionPhotos';

export default function SuggestedSessionCard({
  session: s,
  time,
  onAdd,
}: {
  session: Session;
  time: string;
  onAdd: () => void;
}) {
  const [image, setImage] = useState<string | null>(s.heroImageUrl ?? null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    if (s.heroImageUrl) {
      setImage(s.heroImageUrl);
      return;
    }
    setImage(null);
    let live = true;
    fetchSessionPhotos(s.id).then((photos) => { if (live && photos[0]) setImage(photos[0].url); });
    return () => { live = false; };
  }, [s.id, s.heroImageUrl]);

  const left = Math.max(0, s.capacity - s.enrolled);

  return (
    <article className="flex w-56 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <Link to={`/sessions/${s.id}`} className="block">
        <div className="grid aspect-video place-items-center bg-muted text-muted-foreground">
          {image && !broken ? (
            <img src={image} alt="" width={224} height={126} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6" />
          )}
        </div>
        <div className="px-3 pt-2.5">
          <h3 className="line-clamp-2 text-sm font-semibold">{s.title}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">{time} · {left} seat{left === 1 ? '' : 's'} left</p>
        </div>
      </Link>
      <div className="mt-auto px-3 pb-3 pt-2">
        <Button type="button" size="sm" variant="secondary" onClick={onAdd}><Plus className="h-4 w-4" /> Add</Button>
      </div>
    </article>
  );
}
