// The sponsor tiers as a stepped pyramid, shared by the portal's Summit '27
// page (Sponsors tab) and the landing page's Sponsors section.
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Handshake, Plus } from '@/components/icons';
import { LinkButton, ZeffyFormButton } from './home/AboutSections';
import {
  SPONSORS,
  SPONSOR_FORM_EMBED_URL,
  SPONSOR_FORM_URL,
  SPONSOR_TIERS,
  SPONSORSHIP_DETAILS_URL,
  type Sponsor,
} from '../models/sponsors';
import { cn } from '@/lib/utils';

/**
 * Each step of the pyramid, top to bottom: how wide it is from sm up (the
 * tiers stack into a peak) and its colors. The top two are solid emerald,
 * the rest fade to a light tint.
 */
const TIER_STEPS: { width: string; band: string; solid: boolean }[] = [
  { width: 'sm:w-[56%]', band: 'bg-emerald-deep text-white', solid: true },
  { width: 'sm:w-[67%]', band: 'bg-emerald text-white', solid: true },
  { width: 'sm:w-[78%]', band: 'border border-emerald/25 bg-emerald/[0.15]', solid: false },
  { width: 'sm:w-[89%]', band: 'border border-emerald/20 bg-emerald/[0.09]', solid: false },
  { width: 'sm:w-full', band: 'border border-emerald/15 bg-emerald/[0.04]', solid: false },
];

const TILE = 'flex h-16 w-full items-center justify-center rounded-xl';

/**
 * How many tiles fit across a tier's row. The row is a CSS grid that fits as
 * many 9rem columns as it can (6.75rem on phones, so two fit), so this reads
 * the column count back from the browser and follows it as the window
 * resizes. 1 where there's no layout (tests).
 */
function useGridColumns(ref: RefObject<HTMLElement>): number {
  const [columns, setColumns] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const n = getComputedStyle(el).gridTemplateColumns.split(' ').filter((c) => c.endsWith('px')).length;
      setColumns(Math.max(1, n));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return columns;
}

/**
 * A tier's logos, then open spots filling out the last row so every row is
 * full (a whole row of them when the tier is empty or its logos end a row).
 * Only the first open spot is announced to screen readers; the rest repeat it.
 */
function TierRow({ tier, sponsors, solid, onOpen }: { tier: string; sponsors: Sponsor[]; solid: boolean; onOpen: () => void }) {
  const ref = useRef<HTMLUListElement>(null);
  const columns = useGridColumns(ref);
  const open = columns - (sponsors.length % columns);
  return (
    <ul
      ref={ref}
      className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(6.75rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] sm:gap-4"
      aria-label={`${tier} sponsors`}
    >
      {sponsors.map((s) => (
        <li key={s.name}>
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            title={s.name}
            className={cn(TILE, 'border border-black/5 bg-white px-3 py-2 shadow-sm transition-transform hover:-translate-y-0.5')}
          >
            <img src={s.logo} alt={s.name} loading="lazy" className="max-h-full max-w-full object-contain" />
          </a>
        </li>
      ))}
      {Array.from({ length: open }, (_, k) => (
        <li key={`open-${k}`} aria-hidden={k > 0 || undefined}>
          <OpenSpot tier={tier} solid={solid} first={k === 0} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

/**
 * An open spot in a tier; it opens the sponsor form, like Become a sponsor.
 * The first open spot in a tier says "Your company logo could go here"; the
 * rest are quieter empty slots with a small +, so a row of them doesn't
 * repeat the same words.
 */
function OpenSpot({ tier, solid, first, onOpen }: { tier: string; solid: boolean; first: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={first ? `Your company logo could go here: become a ${tier} sponsor` : undefined}
      title={first ? undefined : `Your company logo could go here: become a ${tier} sponsor`}
      tabIndex={first ? undefined : -1}
      className={cn(
        TILE,
        'border-dashed px-3 text-center transition-colors',
        first ? 'border-[1.5px] text-[12px] font-semibold leading-tight' : 'border',
        solid
          ? first
            ? 'border-white/45 text-white/85 hover:border-white/75 hover:text-white'
            : 'border-white/20 text-white/35 hover:border-white/50 hover:text-white/70'
          : first
            ? 'border-emerald/40 text-emerald/85 hover:border-emerald/65 hover:text-emerald'
            : 'border-emerald/20 text-emerald/35 hover:border-emerald/45 hover:text-emerald/70',
      )}
    >
      {first ? 'Your company logo could go here' : <Plus className="h-4 w-4" aria-hidden />}
    </button>
  );
}

/**
 * The sponsor tiers as a stepped pyramid, Capstone at the peak and
 * Cornerstone at the base, each with its price, perks and logos, and open
 * spots that open the sponsor form.
 */
export default function SponsorTiers({ sponsors = SPONSORS, focus, preview = false }: {
  sponsors?: Sponsor[];
  /** A picture of the pyramid (the landing page's Lineup preview): no buttons, so the sponsor form never preloads. */
  preview?: boolean;
  /**
   * Focus mode (the Lineup page's pinned Sponsors section): the pyramid zooms
   * and pans so this tier sits in the middle of the frame, and the others dim.
   * Leave it out for the plain pyramid.
   */
  focus?: number;
}) {
  const openForm = useRef<(() => void) | null>(null);
  const onOpen = () => openForm.current?.();
  const focusing = focus !== undefined;
  const frame = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const transform = useFocusTransform(frame, list, focus);

  const actions = preview ? null : (
    <div className="sponsor-actions flex flex-wrap gap-2.5">
      <ZeffyFormButton
        label="Become a sponsor"
        dialogTitle="Become a sponsor"
        pageUrl={SPONSOR_FORM_URL}
        embedUrl={SPONSOR_FORM_EMBED_URL}
        icon={Handshake}
        opener={openForm}
      />
      <LinkButton href={SPONSORSHIP_DETAILS_URL}>Sponsorship details</LinkButton>
    </div>
  );
  const wrap = (pyramid: ReactNode) =>
    focusing ? (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {actions}
        {/* The frame clips the zoomed pyramid; only transform and opacity animate, so the browser composites it. */}
        <div ref={frame} className="relative min-h-0 flex-1 overflow-hidden">{pyramid}</div>
      </div>
    ) : (
      <div className="space-y-5">
        {pyramid}
        {actions}
      </div>
    );

  return wrap(
      <ol
        ref={list}
        className={cn(
          'flex flex-col items-center gap-2',
          focusing && 'relative origin-top transition-transform duration-500 ease-[var(--ease-out)] motion-reduce:transition-none',
        )}
        style={focusing ? { transform } : undefined}
        aria-label="Sponsor tiers, highest first"
      >
        {SPONSOR_TIERS.map((t, i) => {
          const step = TIER_STEPS[i];
          const inTier = sponsors.filter((s) => s.tier === t.name);
          return (
            <li
              key={t.name}
              aria-label={t.name}
              aria-current={focusing && focus === i ? 'true' : undefined}
              className={cn(
                'w-full rounded-2xl px-4 py-3.5 sm:px-5',
                step.width,
                step.band,
                focusing && 'transition-[opacity,box-shadow] duration-500',
                focusing && (focus === i ? 'shadow-[0_0_0_2px_rgba(12,122,85,0.55),0_18px_40px_-18px_rgba(0,0,0,0.35)]' : 'opacity-35'),
              )}
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={cn('mt-0.5 font-mono text-[12px] font-semibold tabular-nums', step.solid ? 'text-white/60' : 'text-emerald/70')}
                  aria-hidden
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="font-display text-[16px] font-bold">{t.name}</h3>
                    <span className={cn('font-mono text-[12.5px] font-medium tabular-nums', step.solid ? 'text-white/85' : 'text-emerald')}>
                      {t.amount}
                    </span>
                  </div>
                  <p className={cn('mt-0.5 text-[12.5px] leading-snug', step.solid ? 'text-white/75' : 'text-muted-foreground')}>
                    {t.perks}
                  </p>
                  <TierRow tier={t.name} sponsors={inTier} solid={step.solid} onOpen={onOpen} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>,
  );
}

/** At most this much zoom, so the focused tier stays crisp and its neighbours stay in view. */
const MAX_ZOOM = 1.3;

/**
 * The transform that centres tier `focus` in the frame, zoomed so it fills
 * about half the frame's height (never past MAX_ZOOM, never shrunk). Measured
 * only when the tier or the frame's size changes, never per frame.
 */
function useFocusTransform(frame: RefObject<HTMLElement>, list: RefObject<HTMLElement>, focus: number | undefined): string {
  const [transform, setTransform] = useState('none');
  useLayoutEffect(() => {
    const box = frame.current;
    const ol = list.current;
    if (focus === undefined || !box || !ol) return;
    const place = () => {
      const tier = ol.children[focus] as HTMLElement | undefined;
      const h = box.clientHeight;
      if (!tier || !h) return;
      // Also never wider than the frame, so the wide lower tiers aren't clipped at the sides.
      const fit = (box.clientWidth * 0.98) / tier.offsetWidth;
      const s = Math.max(1, Math.min(MAX_ZOOM, fit, (h * 0.5) / tier.offsetHeight));
      const y = h / 2 - (tier.offsetTop + tier.offsetHeight / 2) * s;
      setTransform(`translate3d(0, ${Math.round(y)}px, 0) scale(${s.toFixed(3)})`);
    };
    place();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    ro.observe(box);
    return () => ro.disconnect();
  }, [frame, list, focus]);
  return transform;
}

