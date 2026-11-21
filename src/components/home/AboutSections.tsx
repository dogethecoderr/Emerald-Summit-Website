// Home's Support EAF and About the app sections (website only for now). The
// sponsors moved to the landing page (src/landing/SponsorTerraces.tsx, data in
// src/models/sponsors.ts). EAF links come from EAF's real site,
// ehsacademics.org (Initiatives → Emerald Summit '27 → Sponsor; checked
// Nov 14, 2026). The old Google Sites page (sites.google.com/view/
// ehs-academic-foundation) is out of date: don't use it.
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, HeartHandshake, Loader2, type AppIcon } from '@/components/icons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsPhoneScreen } from '@/lib/device';
import SummitLogo from '../SummitLogo';
import { cn } from '@/lib/utils';

const EAF_SITE = 'https://www.ehsacademics.org';
/**
 * EAF's Zeffy donation form (the one the organizers sent on Nov 20, 2026).
 * Computers and tablets get it embedded in a popup (the embed's iframe, the
 * same URL Zeffy's embed code falls back to); phones open the full page.
 */
const ZEFFY_FORM = '6938c617-88ca-483d-ab7d-997e94ed8b6c';
export const EAF_DONATE_URL = `https://www.zeffy.com/en-US/donation-form/${ZEFFY_FORM}`;
export const EAF_DONATE_EMBED_URL = `https://www.zeffy.com/embed/donation-form/${ZEFFY_FORM}`;
export const EAF_VOLUNTEER_URL = `${EAF_SITE}/get-involved/parent-volunteering`;
function SectionTitle({ id, children }: { id: string; children: string }) {
  return <h2 id={id} className="mb-3 font-display text-xl font-bold tracking-tight sm:text-2xl">{children}</h2>;
}

function buttonClass(primary?: boolean) {
  return cn(
    'inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors',
    primary ? 'bg-emerald text-white hover:bg-emerald-deep' : 'border border-border bg-card hover:border-emerald/40',
  );
}

export function LinkButton({
  href,
  children,
  primary,
  icon: Icon = ArrowRight,
}: {
  href: string;
  children: string;
  primary?: boolean;
  icon?: AppIcon;
}) {
  const external = !href.startsWith('mailto:');
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel="noreferrer"
      className={buttonClass(primary)}
    >
      {children}
      <Icon className={cn('h-3.5 w-3.5', external && Icon === ArrowRight && '-rotate-45')} aria-hidden />
    </a>
  );
}

/**
 * Donate: on a phone, a link that opens Zeffy's page in a new tab (an
 * embedded payment form in a popup is cramped there); anywhere else, a
 * popup with the Zeffy form embedded, so people give without leaving.
 */
export function DonateButton() {
  const phone = useIsPhoneScreen();
  const [open, setOpen] = useState(false);
  // Zeffy's form takes a few seconds to appear; say so instead of a blank box.
  const [loaded, setLoaded] = useState(false);
  const revealTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(revealTimer.current), []);
  const openChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      window.clearTimeout(revealTimer.current);
      setLoaded(false);
    }
  };
  if (phone) return <LinkButton href={EAF_DONATE_URL} primary icon={HeartHandshake}>Donate</LinkButton>;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(true)}>
        Donate
        <HeartHandshake className="h-3.5 w-3.5" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={openChange}>
        <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
            <DialogTitle className="font-display text-lg">Donate to EAF</DialogTitle>
            <DialogDescription className="text-[13px]">
              Secure form by Zeffy. EAF is a 501(c)(3) nonprofit, so your gift is tax-deductible.{' '}
              <a href={EAF_DONATE_URL} target="_blank" rel="noreferrer" className="font-semibold text-emerald underline-offset-2 hover:underline">
                Open in a new tab
              </a>
            </DialogDescription>
          </DialogHeader>
          <div className="relative h-[min(72vh,760px)] w-full">
            {!loaded && (
              <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading the donation form…
              </p>
            )}
            <iframe
              title="Donation form powered by Zeffy"
              src={EAF_DONATE_EMBED_URL}
              allow="payment"
              // Zeffy's page reports loaded before it draws the form (about
              // 2 s more), so the message stays up a little past onLoad.
              onLoad={() => {
                window.clearTimeout(revealTimer.current);
                revealTimer.current = window.setTimeout(() => setLoaded(true), 2000);
              }}
              className={cn('absolute inset-0 h-full w-full border-0 transition-opacity', loaded ? 'opacity-100' : 'opacity-0')}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SupportEafCard() {
  return (
    <section aria-labelledby="support-eaf">
      <SectionTitle id="support-eaf">Support EAF</SectionTitle>
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <SummitLogo size={64} className="shrink-0" />
          <div className="max-w-3xl space-y-3 text-[14.5px] leading-relaxed">
            <p>
              This Emerald Summit App is brought to you 100% built by students and free for all to use.
            </p>
            <p>
              Emerald Academic Foundation (EAF) supports student-initiated projects, like this app, along
              with several others that bring opportunities to students across areas, ultimately
              empowering leadership, student-initiative, and collaboration.
            </p>
            <p className="font-semibold">Please consider supporting EAF and its mission.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2.5 sm:pl-[80px]">
          <DonateButton />
          <LinkButton href={EAF_VOLUNTEER_URL}>Volunteer with EAF</LinkButton>
        </div>
      </div>
    </section>
  );
}

const LEAD_DEVELOPERS = ['Arjun Mahajan', 'Akhil Muthyala'];
const DEVELOPERS_AND_TESTERS = ['Nihtahli Anand', 'Arush Singh', 'Guhan Bala', 'Deep Shah'];

function joinNames(names: string[]) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function AboutAppCard() {
  return (
    <section aria-labelledby="about-app">
      <SectionTitle id="about-app">About the app</SectionTitle>
      <div className="glass rounded-3xl p-5 sm:p-6">
        <p className="text-[14.5px] leading-relaxed">
          This app has been 100% built by Emerald High School students.
        </p>
        <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Lead developers</dt>
            <dd className="mt-1 font-semibold">{joinNames(LEAD_DEVELOPERS)}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Developers and testers</dt>
            <dd className="mt-1 font-semibold">{joinNames(DEVELOPERS_AND_TESTERS)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
