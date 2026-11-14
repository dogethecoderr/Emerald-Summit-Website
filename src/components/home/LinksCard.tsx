// Home's Links card, the app's _LinksCard: the Summit website, Instagram and
// the contact email, each opening outside the site.
import { ArrowRight, Globe, Instagram, Mail, type AppIcon } from '@/components/icons';

export const SUMMIT_LINKS: { label: string; url: string; icon: AppIcon }[] = [
  { label: 'Summit website', url: 'https://sites.google.com/view/ehs-academic-foundation/programs/emerald-summit', icon: Globe },
  { label: 'Instagram', url: 'https://www.instagram.com/emeraldsummit27?stkn=MzRlODBiNWFlZA==', icon: Instagram },
  { label: 'Contact', url: 'mailto:president@ehsacademics.org', icon: Mail },
];

export default function LinksCard() {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold tracking-tight sm:text-2xl">Links</h2>
      <ul className="glass divide-y divide-border overflow-hidden rounded-2xl">
        {SUMMIT_LINKS.map(({ label, url, icon: Icon }) => (
          <li key={label}>
            <a
              href={url}
              target={url.startsWith('mailto:') ? undefined : '_blank'}
              rel="noreferrer"
              className="group flex items-center gap-3 px-4 py-3.5 text-[14px] font-semibold transition-colors hover:bg-muted/50"
            >
              <Icon className="h-5 w-5 text-emerald" />
              <span className="flex-1">{label}</span>
              <ArrowRight className="h-4 w-4 -rotate-45 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
