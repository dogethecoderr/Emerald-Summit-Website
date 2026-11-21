import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { X } from '@/components/icons';
import { currentPlatform, type DevicePlatform } from '@/lib/device';
import { storeNameFor, storeUrlFor } from '@/lib/appStores';

// A website-made "smart app banner": on an iPhone, iPad or Android device it
// slides up a card that says the app is the better way in and links to that
// device's store. Computers never see it. It only shows for a store that has a
// link in src/lib/appStores.ts, so it stays hidden until the app is live.
//
// Preview it on any device, link or not, with ?app-banner=ios or
// ?app-banner=android on any page.

const HIDDEN_UNTIL_KEY = 'app_banner_hidden_until';
export const APP_BANNER_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
/** Wait this long after load so the banner isn't the first thing that moves. */
const SHOW_DELAY_MS = 2500;

// Used when storage is blocked, so a dismissal still holds for this tab.
let hiddenUntilInMemory = 0;

function hiddenUntil(): number {
  try {
    const raw = localStorage.getItem(HIDDEN_UNTIL_KEY);
    return raw == null ? hiddenUntilInMemory : Number(raw) || 0;
  } catch {
    return hiddenUntilInMemory;
  }
}

function snooze(now: number = Date.now()): void {
  hiddenUntilInMemory = now + APP_BANNER_SNOOZE_MS;
  try {
    localStorage.setItem(HIDDEN_UNTIL_KEY, String(hiddenUntilInMemory));
  } catch {
    // Storage blocked: the in-memory copy above covers this tab.
  }
}

function previewPlatform(search: string): DevicePlatform | null {
  const value = new URLSearchParams(search).get('app-banner');
  return value === 'ios' || value === 'android' ? value : null;
}

/** Which store to offer on this device, or null when the banner shouldn't show. */
export function bannerPlatform(
  platform: DevicePlatform,
  search: string,
  now: number = Date.now(),
): { platform: DevicePlatform; url: string | null } | null {
  const preview = previewPlatform(search);
  if (preview) return { platform: preview, url: storeUrlFor(preview) };
  if (platform === 'other') return null;
  const url = storeUrlFor(platform);
  if (!url || hiddenUntil() > now) return null;
  return { platform, url };
}

export default function GetTheAppBanner() {
  const reduceMotion = useReducedMotion();
  const [offer] = useState(() =>
    bannerPlatform(currentPlatform(), typeof window === 'undefined' ? '' : window.location.search),
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!offer) return;
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [offer]);

  if (!offer) return null;
  const store = storeNameFor(offer.platform);

  const dismiss = () => {
    snooze();
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          role="complementary"
          aria-label="Get the Emerald Summit app"
          className="app-banner fixed inset-x-3 z-[60] mx-auto max-w-md"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative flex items-center gap-3 rounded-2xl border border-border bg-card p-3 pr-3 text-card-foreground shadow-md">
            <img
              src="/apple-touch-icon-dragon.png"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-lg ring-1 ring-black/5"
            />
            <div className="min-w-0 flex-1 pr-1">
              <p className="text-[14px] font-semibold leading-snug">Better in the app</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                Your schedule, QR pass and news in one place. Free on {store}.
              </p>
            </div>
            <a
              href={offer.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!offer.url) {
                  e.preventDefault();
                  toast(`The ${store} link isn't set yet. Add it in src/lib/appStores.ts.`);
                  return;
                }
                snooze();
                setVisible(false);
              }}
              aria-label={`Get the app on ${store}`}
              className="shrink-0 rounded-md bg-emerald px-5 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-emerald/90"
            >
              Get
            </a>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Not now"
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
