import { useLocation, useNavigate } from 'react-router-dom';
import { Mail } from '@/components/icons';
import BrandMark from './BrandMark';

const SITE_LINKS = [
  { to: '/', label: 'Home', anchor: null },
  { to: '/#about', label: 'About', anchor: 'about' },
  { to: '/#universes', label: 'Universes', anchor: 'universes' },
  { to: '/#faq', label: 'FAQ', anchor: 'faq' },
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
    <footer className="lp lp-night lp-footer">
      <div className="container lp-grid">
        <div className="lp-footer__brand">
          <BrandMark
            logoClassName="h-10 w-10"
            titleClassName="text-base font-semibold tracking-tight text-white"
            subtitleClassName="text-[13px] text-white/70"
          />
          <p>
            A student-run STEAM Summit for Tri-Valley high schoolers, with six
            universes, one day, 100% free.
          </p>
        </div>

        <nav className="lp-footer__col" aria-labelledby="footer-explore">
          <p id="footer-explore" className="lp-footer__label">
            Explore
          </p>
          <ul>
            {SITE_LINKS.map((l) => (
              <li key={l.label}>
                <button
                  type="button"
                  onClick={() => goTo(l.anchor, l.to)}
                  className="lp-footer__link"
                >
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lp-footer__col">
          <p className="lp-footer__label">Contact</p>
          <ul>
            <li>
              <a href="mailto:contact@ehsacademics.org" className="lp-footer__link">
                <Mail aria-hidden /> contact@ehsacademics.org
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="lp-footer__link"
              >
                Sign in
              </button>
            </li>
          </ul>
        </div>

        <div className="lp-footer__legal">
          <span>Emerald Summit ’27, Dublin, CA</span>
        </div>
      </div>
    </footer>
  );
}
