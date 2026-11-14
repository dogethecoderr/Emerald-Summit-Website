// Home's photo slideshow, the app's _PhotoSlideshow: every photo in the
// gallery_photos bucket, a new one every 5 seconds, looping, with dots. Hidden
// when the bucket is empty. Only the photo on screen and the next one are
// loaded, to keep Storage egress down.
import { useEffect, useState } from 'react';
import { fetchHomeGallery, type SessionPhoto } from '../../services/sessionPhotos';
import { cn } from '@/lib/utils';

const INTERVAL_MS = 5000;

export default function PhotoSlideshow({ className }: { className?: string }) {
  const [photos, setPhotos] = useState<SessionPhoto[]>([]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let live = true;
    fetchHomeGallery().then((list) => { if (live) setPhotos(list); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (photos.length < 2 || paused) return;
    const t = setInterval(() => setActive((i) => (i + 1) % photos.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [photos.length, paused]);

  if (photos.length === 0) return null;
  const next = (active + 1) % photos.length;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Summit photos"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn('relative aspect-[2/1] overflow-hidden rounded-3xl bg-muted', className)}
    >
      {photos.map((p, i) => (i === active || i === next) && (
        <img
          key={p.name}
          src={p.url}
          alt=""
          width={1280}
          height={720}
          aria-hidden={i !== active}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none',
            i === active ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/40 to-transparent" aria-hidden />
      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
          {photos.map((p, i) => (
            <button
              key={p.name}
              type="button"
              aria-label={`Photo ${i + 1} of ${photos.length}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className={cn('h-1.5 rounded-full transition-all', i === active ? 'w-4 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/80')}
            />
          ))}
        </div>
      )}
    </section>
  );
}
