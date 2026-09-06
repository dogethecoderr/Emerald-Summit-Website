import { useLocation, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import BrandMark from './BrandMark';

const SITE_LINKS = [
  { to: '/', label: 'Home', anchor: null },
  { to: '/#about', label: 'About', anchor: 'about' },
  { to: '/#universes', label: 'Universes', anchor: 'universes' },
  { to: '/#faq', label: 'FAQ', anchor: 'faq' },
  { to: '/app', label: 'App', anchor: null },
];

export default function LandingFooter() {
  const navigate = useNavigate();
  const location = useLocation();

  const goTo = (anchor: string | null, to: string) => {
    if (!anchor) {
      navigate(to);
      return;
    }
    if (location.pathname === '/') {
      document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate('/', { state: { scrollTo: anchor } });
    }
  };

  return (
    <footer className="bg-navy text-white/70">
      <div className="mx-auto max-w-[1440px] px-6 py-14 lg:px-14 lg:py-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          <div className="max-w-xs">
            <BrandMark
              logoClassName="h-9 w-9"
              titleClassName="text-[15px] font-semibold tracking-tight text-white"
              subtitleClassName="text-[11px] text-white/50"
            />
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              A student-run STEAM Summit for Tri-Valley high schoolers — six
              universes, one day, 100% free.
            </p>
            <p className="mt-3 text-xs text-white/40">
              January 2027 · Emerald High School, Dublin, CA
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Explore
              </div>
              <ul className="mt-4 space-y-2.5">
                {SITE_LINKS.map((l) => (
                  <li key={l.label}>
                    <button
                      type="button"
                      onClick={() => goTo(l.anchor, l.to)}
                      className="text-sm text-white/65 transition-colors hover:text-white"
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Contact
              </div>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a
                    href="mailto:contact.ehsaf@gmail.com"
                    className="inline-flex items-center gap-1.5 text-sm text-white/65 transition-colors hover:text-white"
                  >
                    <Mail className="h-3.5 w-3.5" /> Email
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/home')}
                    className="text-sm text-white/65 transition-colors hover:text-white"
                  >
                    Sign in
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-white/40">
          EHS Academic Foundation · Emerald Summit ’27 · Dublin, CA
        </div>
      </div>
    </footer>
  );
}
