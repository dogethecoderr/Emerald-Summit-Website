// Home's About the app, Support EAF and Sponsors sections (website only for
// now). EAF facts and sponsor tiers come from the EAF site:
// sites.google.com/view/ehs-academic-foundation (Donate, Volunteer, and
// Programs → Emerald Summit → Sponsorship Details).
import {
  ArrowRight,
  CalendarDays,
  HeartHandshake,
  Mail,
  Megaphone,
  Orbit,
  QrCode,
  type AppIcon,
} from '@/components/icons';
import { cn } from '@/lib/utils';

const EAF_SITE = 'https://sites.google.com/view/ehs-academic-foundation';
export const EAF_DONATE_URL = `${EAF_SITE}/donate`;
export const EAF_VOLUNTEER_URL = `${EAF_SITE}/volunteer`;
export const SPONSORSHIP_DETAILS_URL = `${EAF_SITE}/programs/emerald-summit/sponsorship-details`;
export const SPONSOR_EMAIL = 'contact.ehsaf@gmail.com';

const APP_FEATURES: { icon: AppIcon; title: string; sub: string }[] = [
  { icon: CalendarDays, title: 'Build your schedule', sub: 'Pick sessions and save your seat before the day.' },
  { icon: QrCode, title: 'Check in with a QR pass', sub: 'Show it at the door. No paper tickets.' },
  { icon: Megaphone, title: 'Get announcements', sub: 'Schedule changes and news from the organizers.' },
  { icon: Orbit, title: 'Explore the verses', sub: 'Read up on every discipline and its tracks.' },
];

export const SPONSOR_TIERS: { name: string; amount: string; perks: string }[] = [
  { name: 'Cornerstone', amount: '$500+', perks: 'Keynote mention, logo on event slides, a spot on this portal' },
  { name: 'Foundation', amount: '$1,000+', perks: 'Cornerstone, plus an entrance banner or a Student Union table' },
  { name: 'Pillar', amount: '$1,500+', perks: 'Foundation, plus banners in specific tracks' },
  { name: 'Keystone', amount: '$2,000+', perks: 'Pillar, plus a year-long portal link and a Student Union logo or table' },
  { name: 'Capstone', amount: '$5,000+', perks: 'Top billing on all media and event signage' },
  { name: 'Legacy Builder', amount: '$10,000+', perks: 'A custom partnership set up with the EAF board' },
];

function SectionTitle({ id, children }: { id: string; children: string }) {
  return <h2 id={id} className="mb-3 font-display text-xl font-bold tracking-tight sm:text-2xl">{children}</h2>;
}

function LinkButton({
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
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold transition-colors',
        primary
          ? 'bg-emerald text-white hover:bg-emerald-deep'
          : 'border border-border bg-card hover:border-emerald/40',
      )}
    >
      {children}
      <Icon className={cn('h-3.5 w-3.5', external && Icon === ArrowRight && '-rotate-45')} aria-hidden />
    </a>
  );
}

export function AboutAppCard() {
  return (
    <section aria-labelledby="about-app" className="flex flex-col">
      <SectionTitle id="about-app">About the app</SectionTitle>
      <div className="glass flex flex-1 flex-col rounded-3xl p-5 sm:p-6">
        <p className="text-[14.5px] leading-relaxed text-muted-foreground">
          This portal is where you plan and get through summit day. A phone app with the same
          features is on the way.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {APP_FEATURES.map(({ icon: Icon, title, sub }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent text-emerald">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold">{title}</span>
                <span className="block text-[12.5px] leading-snug text-muted-foreground">{sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function SupportEafCard() {
  return (
    <section aria-labelledby="support-eaf" className="flex flex-col">
      <SectionTitle id="support-eaf">Support EAF</SectionTitle>
      <div className="flex flex-1 flex-col rounded-3xl border border-emerald/20 bg-gradient-to-br from-emerald/10 to-emerald/[0.03] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald text-white">
            <HeartHandshake className="h-5 w-5" />
          </span>
          <p className="text-[14.5px] leading-relaxed">
            The Emerald High School Academic Foundation runs Emerald Summit. It builds academic
            opportunities, mentorship, leadership and entrepreneurship for every Emerald High student.
          </p>
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">
          EAF is a 501(c)(3) nonprofit. Tax ID 33-4810954.
        </p>
        <div className="mt-auto flex flex-wrap gap-2.5 pt-5">
          <LinkButton href={EAF_DONATE_URL} primary>Donate</LinkButton>
          <LinkButton href={EAF_VOLUNTEER_URL}>Volunteer with EAF</LinkButton>
        </div>
      </div>
    </section>
  );
}

export function SponsorsCard() {
  return (
    <section aria-labelledby="sponsors">
      <SectionTitle id="sponsors">Sponsors</SectionTitle>
      <div className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <p className="flex-1 text-[14.5px] leading-relaxed text-muted-foreground">
            Local businesses and organizations help make the summit happen. Sponsors will be listed
            here as they sign on.
          </p>
          <div className="flex shrink-0 flex-wrap gap-2.5">
            <LinkButton href={`mailto:${SPONSOR_EMAIL}`} primary icon={Mail}>Become a sponsor</LinkButton>
            <LinkButton href={SPONSORSHIP_DETAILS_URL}>Sponsorship details</LinkButton>
          </div>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SPONSOR_TIERS.map((t) => (
            <li key={t.name} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[16px] font-bold">{t.name}</span>
                <span className="font-mono text-[12.5px] font-medium tabular-nums text-emerald">{t.amount}</span>
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{t.perks}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
