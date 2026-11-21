import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LandingNav from '../components/LandingNav';
import FaqSection from '../components/FaqSection';
import OrbitalUniverses from '../components/OrbitalUniverses';
import PhotoMosaic from '../components/PhotoMosaic';
import LandingFooter from '../components/LandingFooter';
import PhotoRail from '../landing/PhotoRail';
import HairlineFigure from '../landing/HairlineFigure';
import { SIGN_IN_ROLES } from '../models/roles';
import { DAY_PARTS, type DayPart } from '../landing/dayParts';
import { Mail } from '@/components/icons';
import { useIsTouchScreen } from '../lib/device';
import '../landing/landing.css';

const VENUE = 'Emerald High School, Dublin, CA';
const CONTACT_EMAIL = 'contact@ehsacademics.org';

const ABOUT_STATS = [
  { value: '1', label: 'Day', note: 'One campus, Emerald High' },
  { value: '6', label: 'Disciplines', note: 'TechVerse to CivicVerse' },
  { value: '20+', label: 'Tracks', note: 'From Robothon to Mock Trial' },
  { value: '30+', label: 'Visiting experts', note: 'Giving feedback and leading the talks' },
];

/** The five roles anyone can sign in as, in the order the badges hang. */
const BADGE_ROLES = SIGN_IN_ROLES;

/**
 * Where a badge or role row leads: that role's sign-up. Admins have no sign-up
 * (the allowlist decides who is one), so theirs is Organizer sign in.
 */
const signUpPath = (role: string) => (role === 'admin' ? '/login/admin' : `/login/${role}?mode=signup`);

/** The owner's own photographs from the last Summit, in rail order. */
const DAY_PHOTOS: { n: number; alt: string; tall?: boolean }[] = [
  { n: 19, alt: 'Two students show their project to a visiting expert' },
  { n: 10, alt: 'Students gather around a robot they built' },
  { n: 13, alt: 'A student walks a visitor through her design project poster' },
  { n: 28, alt: 'A VentureVerse panel on stage in the lecture hall' },
  { n: 17, alt: 'Three students present to a visiting expert' },
  { n: 26, alt: 'Students and families fill the gym bleachers' },
  { n: 30, alt: 'A team presents their BiteWise nutrition idea' },
];

const photo = (n: number) => `/gallery/photo-${String(n).padStart(2, '0')}.jpg`;

const RAIL_PHOTOS = DAY_PHOTOS.map((p) => ({
  src: photo(p.n),
  alt: p.alt,
  width: p.tall ? 900 : 1200,
  height: p.tall ? 1200 : 798,
}));

export default function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const touch = useIsTouchScreen();
  const [part, setPart] = useState(0);
  const [badge, setBadge] = useState(-1);
  // The badge picked so far, read synchronously by the click (state lags a render).
  const badgeRef = useRef(-1);
  // A touch picks a badge on its first tap; only a tap on the badge already out opens sign-up.
  const badgeTap = useRef<{ before: number; touch: boolean }>({ before: -1, touch: false });
  const pickBadge = (i: number) => {
    badgeRef.current = i;
    setBadge(i);
  };

  // Cross-route anchor nav: LandingNav sends { scrollTo: id } when the link
  // is clicked from a different route; finish the scroll once we've landed.
  useEffect(() => {
    const scrollTo = (location.state as { scrollTo?: string } | null)
      ?.scrollTo;
    if (!scrollTo) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(scrollTo)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    window.history.replaceState({}, '');
    return () => cancelAnimationFrame(frame);
  }, [location.state]);

  return (
    <div className="lp lp-page">
      <LandingNav />

      <main id="main">
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="container lp-hero__inner">
            <div className="lp-hero__copy">
              <p className="lp-hero__lede">
                The Tri-Valley’s largest student-led STEAM conference
              </p>
              <h1 id="hero-title" className="lp-hero__title">
                Emerald<br />Summit
              </h1>
              <div className="lp-hero__aside">
                <p className="lp-hero__when">
                  <span>Saturday, January 23, 2027</span>
                  <span>9 AM to 5 PM</span>
                  <span>{VENUE}</span>
                </p>
                <div className="lp-hero__actions">
                  <button type="button" className="lp-btn" onClick={() => navigate('/home')}>
                    Get started
                  </button>
                  <button
                    type="button"
                    className="lp-btn lp-btn--quiet"
                    onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    Learn more
                  </button>
                </div>
              </div>
            </div>
            <figure className="lp-hero__photo">
              <img
                src={photo(19)}
                alt="Two students show their project to a visiting expert"
                width={1200}
                height={798}
                fetchPriority="high"
              />
              <figcaption>Projects and conversations from a previous Summit.</figcaption>
            </figure>
          </div>
        </section>

        {/* What is it? The answer, the owner's photograph, the four figures. */}
        <section id="about" className="lp-section" aria-labelledby="about-title">
          <div className="container lp-grid">
            <div className="lp-about__text">
              <h2 id="about-title">What is Emerald Summit?</h2>
              <p>
                A day at Emerald High where students share project ideas,
                work on them together, and get feedback from visiting experts
                across six disciplines.
              </p>
            </div>
            <PhotoMosaic className="lp-about__photo" />
            <dl className="lp-figures">
              {ABOUT_STATS.map((s) => (
                <div key={s.label}>
                  <dt>
                    <span className="lp-figures__label">{s.label}</span>
                    <span className="lp-figures__note">{s.note}</span>
                  </dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* The day from the peak down: the Summit figure, and the part of the day it has out. */}
        <section id="day" className="lp-section lp-day" aria-labelledby="day-title">
          <div className="container lp-grid lp-day__inner">
            <div className="lp-day__head">
              <h2 id="day-title">What happens on Summit day?</h2>
            </div>
            <figure className="lp-day__figure">
              <HairlineFigure
                name="summit"
                label="The Summit day as a stepped mountain of six terraces, check-in at the peak down to the landing at the base, with Emerald High's flag on top"
                className="lp-hairline lp-hairline--summit"
                onPick={setPart}
              />
              <figcaption className="lp-day__hint">
                {touch ? 'Tap' : 'Hover over'} a terrace to see that part of the day.
              </figcaption>
            </figure>
            <DayPanel part={DAY_PARTS[part]} index={part} />
          </div>
        </section>

        {/* The lineup: a scroll-driven orbit of the six disciplines and their tracks. */}
        <OrbitalUniverses />

        {/* The day, in the owner's photographs. */}
        <section className="lp-section lp-section--tight" aria-labelledby="rail-title">
          <PhotoRail
            photos={RAIL_PHOTOS}
            label="Photographs from the last Summit"
            renderControls={(controls) => (
              <div className="container">
                <div className="lp-head lp-head--row">
                  <h2 id="rail-title">What did the previous years look like?</h2>
                  {controls}
                </div>
              </div>
            )}
          />
        </section>

        <FaqSection />

        {/* The close: who you're coming as, on the badge rack, and the way in. */}
        <section id="roles" className="lp-section lp-roles" aria-labelledby="roles-title">
          <div className="container lp-grid lp-roles__inner">
            {/* The figure is a picture for screen readers; the role rows beside it are the real links. */}
            <figure
              className="lp-roles__figure"
              onPointerDownCapture={(e) => { badgeTap.current = { before: badgeRef.current, touch: e.pointerType !== 'mouse' }; }}
              onClick={() => {
                const i = badgeRef.current;
                if (i < 0 || (badgeTap.current.touch && badgeTap.current.before !== i)) return;
                navigate(signUpPath(BADGE_ROLES[i].name));
              }}
            >
              <HairlineFigure
                name="badges"
                label="Five lanyard badges hanging on a rack, one for each way to sign in to the Summit"
                className="lp-hairline"
                onPick={pickBadge}
              />
            </figure>
            <div className="lp-roles__text">
              <h2 id="roles-title">Who are you coming as?</h2>
              <ul className="lp-roles__list">
                {BADGE_ROLES.map((r, i) => (
                  <li key={r.name} className={badge === i ? 'is-active' : undefined}>
                    <Link to={signUpPath(r.name)} className="lp-roles__link">
                      <h3>{r.label}</h3>
                      <p>{r.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
              <button type="button" className="lp-btn" onClick={() => navigate('/roles')}>
                Choose your role
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* The close: the way in, and who to write to. */}
      <section id="contact" className="lp-night lp-cta" aria-labelledby="contact-title">
        <div className="container lp-cta__inner">
          <h2 id="contact-title">Start the trek.</h2>
          <p className="lp-cta__lede">
            Free to attend. Questions? Email us.
          </p>
          <div className="lp-cta__actions">
            <button type="button" className="lp-btn" onClick={() => navigate('/home')}>
              Get started
            </button>
            <a href={`mailto:${CONTACT_EMAIL}`} className="lp-btn lp-btn--quiet">
              <Mail aria-hidden /> {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

/** The part of the day the Summit figure has out: its photograph, name and the facts about it. */
function DayPanel({ part, index }: { part: DayPart; index: number }) {
  return (
    <div className="lp-day__panel" aria-live="polite">
      {part.photo ? (
        <figure className="lp-day__photo" data-slot={`day-part-${index + 1}`} data-alt={part.photo.alt}>
          <img
            key={part.photo.n}
            src={photo(part.photo.n)}
            width={1200}
            height={798}
            alt={part.photo.alt}
            loading="lazy"
            decoding="async"
          />
        </figure>
      ) : null}
      <p className="lp-day__step num">
        {index + 1} of {DAY_PARTS.length}
      </p>
      <h3 className="lp-day__name">{part.name}</h3>
      <ul className="lp-day__points">
        {part.points.map((pt) => (
          <li key={pt}>{pt}</li>
        ))}
        {part.pending && (
          <li>
            <span className="fill" data-fill={part.name}>
              {part.pending}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
