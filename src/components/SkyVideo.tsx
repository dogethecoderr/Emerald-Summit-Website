import { useEffect, useRef, useState } from 'react';

/**
 * Where the sun finishes setting in the encoded sequence — the same T_SET the
 * canvas version cued on. Kept in sync with `scripts/capture-sky.mjs`, which
 * renders the timeline in `MountainSkyline.tsx`.
 */
const CUE_AT = 14.6;

/**
 * Hard ceiling on how long the page may stay locked waiting for the video.
 * Autoplay refusal, a decode error and a stalled download all land here, so
 * the hero copy can never be held hostage by the background.
 */
const CUE_DEADLINE_MS = 18_000;

/**
 * Portrait viewports get their own encode. The range is anchored to the
 * bottom of the frame and stretches edge to edge, so cover-cropping a
 * landscape file into a phone viewport cuts most of it away.
 */
function pickVariant(): 'landscape' | 'portrait' {
  try {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // A viewport that has not been measured yet reports 0, and 0x0 satisfies
    // a `max-aspect-ratio: 1/1` media query — which is how asking the query
    // directly ends up committing to the portrait file on a desktop load.
    // Fall back to landscape until the dimensions are real; the resize
    // listener corrects it the moment they are.
    if (!(w > 0 && h > 0)) return 'landscape';
    return h > w ? 'portrait' : 'landscape';
  } catch {
    return 'landscape';
  }
}

interface SkyVideoProps {
  /** False on a repeat visit or under reduced motion — shows the still. */
  playIntro?: boolean;
  /** Set when the viewer hits Skip; jumps straight to the settled sky. */
  skip?: boolean;
  onCueContent?: () => void;
}

/**
 * The hero's night sky. The arrival sequence is a pre-rendered video rather
 * than a live canvas, so the landing page costs a hardware-accelerated decode
 * instead of ~900 stars and a 108-spoke corona composited every frame.
 *
 * The video is not looped: it ends on the settled sky and holds that frame,
 * which is what the canvas version came to rest on anyway.
 */
export default function SkyVideo({
  playIntro = false,
  skip = false,
  onCueContent,
}: SkyVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cuedRef = useRef(false);

  const [variant, setVariant] = useState(pickVariant);

  /**
   * The orientation the video is committed to. It follows `variant` freely
   * until playback actually begins and is frozen from then on: swapping the
   * src mid-sequence would restart the arrival from black, but pinning it at
   * first render is worse — the first measurement can be taken before the
   * viewport has settled, and this then commits to the wrong file for good.
   */
  const [videoVariant, setVideoVariant] = useState(variant);
  const startedRef = useRef(false);
  // Falls back to the still if the file errors — a broken background must not
  // leave the hero on a black rectangle.
  const [failed, setFailed] = useState(false);

  const onCueRef = useRef(onCueContent);
  onCueRef.current = onCueContent;

  useEffect(() => {
    const sync = () => {
      const next = pickVariant();
      setVariant(next);
      if (!startedRef.current) setVideoVariant(next);
    };
    // Re-read on mount as well as on resize: the viewport can go from
    // unmeasured to real between first render and this effect attaching.
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  const cue = () => {
    if (cuedRef.current) return;
    cuedRef.current = true;
    onCueRef.current?.();
  };

  // Skip: drop the video, show the settled still, release the page at once.
  useEffect(() => {
    if (skip) cue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  useEffect(() => {
    if (!playIntro) {
      cue();
      return;
    }
    // Reaching the deadline means the sequence never got where it was going —
    // it was refused, it stalled, or the tab was in the background the whole
    // time (browsers pause video in a hidden document). Whatever the cause,
    // dropping to the still is the coherent end state: otherwise the hero
    // copy lands over a frozen mid-warp frame that then resumes behind it.
    const id = setTimeout(() => {
      if (cuedRef.current) return;
      setFailed(true);
      cue();
    }, CUE_DEADLINE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playIntro]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playIntro || skip || failed) return;

    let alive = true;
    // `autoPlay` on the element is what actually starts it — the browser
    // fires it the moment enough data has arrived, with no effect-timing
    // race. This call only exists to surface a refusal, and is retried on
    // canplay because a play() issued before the first byte lands is
    // routinely aborted (React's dev double-mount triggers exactly that).
    const attempt = () => {
      video.play().catch((err: DOMException) => {
      // Only an autoplay refusal is fatal — iOS blocks it in Low Power Mode
      // even for a muted video, and we must not leave the viewer staring at a
      // frozen first frame behind a locked page. An AbortError just means the
      // element was swapped or detached mid-load (React's dev double-mount
      // does exactly this), and retrying is handled by the effect re-running.
        if (!alive || err?.name === 'AbortError') return;
        setFailed(true);
      });
    };

    attempt();
    video.addEventListener('canplay', attempt);

    return () => {
      alive = false;
      video.removeEventListener('canplay', attempt);
    };
  }, [playIntro, skip, failed]);

  const still = `/sky/${variant}-settled.jpg`;
  const showVideo = playIntro && !skip && !failed;

  return (
    <div className="absolute inset-0 overflow-hidden bg-black" aria-hidden>
      {showVideo ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          playsInline
          preload="auto"
          // No `loop`: the last frame is the settled sky and should hold.
          onTimeUpdate={(e) => {
            if (e.currentTarget.currentTime >= CUE_AT) cue();
          }}
          onPlaying={() => {
            startedRef.current = true;
          }}
          onEnded={cue}
          onError={() => setFailed(true)}
        >
          <source src={`/sky/${videoVariant}.mp4`} type="video/mp4" />
        </video>
      ) : (
        <img
          src={still}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Soft fade into the light page below. Kept out of the encode and
          layered here so it tracks the page background rather than baking
          one theme's colour into the video. */}
      <div
        className="absolute inset-x-0 bottom-0 h-24"
        style={{
          background:
            'linear-gradient(to bottom, transparent, hsl(var(--background)))',
        }}
      />
    </div>
  );
}
