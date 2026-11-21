import type { CSSProperties } from 'react';
import { toMinutes, useSummitContent } from '../services/summitContent';
import { VERSE_DISCIPLINES as USER_DISCIPLINES } from '../models/verseVibes';
import { MOCK_SESSIONS } from '../models/sessions';

/**
 * A discipline's sessions by title, earliest first: tracks are sessions. Not the
 * session's `track` column, which some rows fill with the discipline's own name
 * ("NovaSphere") or a group ("Engineering Track"), so it named the discipline as
 * a track and folded sessions that share it into one.
 */
function sessionTitles(discipline: string): string[] {
  const titles = MOCK_SESSIONS.filter((s) => s.track === discipline)
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time))
    .map((s) => s.title.trim())
    .filter(Boolean);
  return [...new Set(titles)];
}

/** The disciplines and their tracks, in the same clear index on every screen. */
export default function OrbitalUniverses() {
  useSummitContent();
  return (
    <section id="disciplines" className="lp-section lp-universes" aria-labelledby="universes-title">
      <div className="container">
        <div className="lp-head">
          <h2 id="universes-title">Which discipline is yours?</h2>
        </div>
        <ul className="lp-uni">
          {USER_DISCIPLINES.map((d) => (
            <li
              key={d.name}
              className="lp-grid lp-uni__row"
              style={{ '--uni': d.color } as CSSProperties}
            >
              <h3 className="lp-uni__name">{d.label}</h3>
              <p className="lp-uni__desc">{d.description}</p>
              <ul className="lp-uni__tracks" aria-label={`${d.label} tracks`}>
                {sessionTitles(d.name).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
