// The landing page's sponsors: a flat, 2D stepped mountain with one terrace
// per sponsor tier (Capstone at the peak, Cornerstone at the base) carrying
// that tier's logos, and on the left the tier the pointer or keyboard has out:
// its price, what it includes and who sponsors at it. The 2D cousin of the
// "What happens on Summit day?" terraces.
import { useState } from 'react';
import { ArrowRight, Mail } from '@/components/icons';
import { SPONSORS, SPONSOR_EMAIL, SPONSOR_TIERS, SPONSORSHIP_DETAILS_URL, type Sponsor } from '../models/sponsors';
import { useIsTouchScreen } from '../lib/device';

export default function SponsorTerraces({ sponsors = SPONSORS }: { sponsors?: Sponsor[] }) {
  const touch = useIsTouchScreen();
  const [active, setActive] = useState(0);
  const tier = SPONSOR_TIERS[active];
  const inTier = (name: string) => sponsors.filter((s) => s.tier === name);
  const here = inTier(tier.name);
  const subject = encodeURIComponent(`${tier.name} sponsorship, Emerald Summit '27`);

  return (
    <section id="sponsors" className="lp-section lp-sponsors" aria-labelledby="sponsors-title">
      <div className="container lp-grid lp-sponsors__inner">
        <div className="lp-sponsors__head">
          <h2 id="sponsors-title">Who helps make the Summit happen?</h2>
        </div>

        <div className="lp-sponsors__panel" aria-live="polite">
          <p className="lp-sponsors__step num">
            {String(active + 1).padStart(2, '0')} of {String(SPONSOR_TIERS.length).padStart(2, '0')}
          </p>
          <div className="lp-sponsors__title">
            <h3 className="lp-sponsors__name">{tier.name}</h3>
            <span className="lp-sponsors__amount num">{tier.amount}</span>
          </div>
          <p className="lp-sponsors__perks">{tier.perks}</p>
          <div className="lp-sponsors__who">
            <p className="lp-sponsors__label">{here.length ? `${tier.name} sponsors` : 'No sponsors at this level yet'}</p>
            {here.length > 0 ? (
              <ul className="lp-sponsors__logos">
                {here.map((s) => (
                  <li key={s.name}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="lp-sponsors__logo" title={s.name}>
                      <img src={s.logo} alt={s.name} loading="lazy" decoding="async" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lp-sponsors__empty">Your company's logo could be the first one here.</p>
            )}
          </div>
          <div className="lp-sponsors__actions">
            <a href={`mailto:${SPONSOR_EMAIL}?subject=${subject}`} className="lp-btn">
              <Mail aria-hidden /> Become a {tier.name} sponsor
            </a>
            <a href={SPONSORSHIP_DETAILS_URL} target="_blank" rel="noreferrer" className="lp-btn lp-btn--quiet">
              Sponsorship details <ArrowRight aria-hidden className="-rotate-45" />
            </a>
          </div>
        </div>

        <figure className="lp-sponsors__figure">
          <ol className="lp-terraces" aria-label="Sponsor tiers, highest first">
            <li aria-hidden className="lp-terraces__peak" />
            {SPONSOR_TIERS.map((t, i) => {
              const logos = inTier(t.name);
              return (
                <li key={t.name} className="lp-terraces__row">
                  <button
                    type="button"
                    className="lp-terrace"
                    data-tier={i}
                    aria-pressed={active === i}
                    aria-label={`${t.name}, ${t.amount}, ${logos.length ? logos.map((s) => s.name).join(', ') : 'no sponsors yet'}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onClick={() => setActive(i)}
                  >
                    <span className="lp-terrace__label">
                      <span className="num">{String(i + 1).padStart(2, '0')}</span> {t.name}
                    </span>
                    <span className="lp-terrace__logos" aria-hidden>
                      {logos.length > 0
                        ? logos.map((s) => (
                            <span key={s.name} className="lp-terrace__chip">
                              <img src={s.logo} alt="" loading="lazy" decoding="async" />
                            </span>
                          ))
                        : <span className="lp-terrace__open">Open</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <figcaption className="lp-day__hint">
            {touch ? 'Tap' : 'Hover over'} a terrace to see that sponsor level.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
