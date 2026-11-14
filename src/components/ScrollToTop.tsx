import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { noteRoute } from '../lib/diagnostics';

/**
 * React Router doesn't reset scroll position between route changes (unlike
 * a full page load), so navigating away from a scrolled-down page lands at
 * the same pixel offset on the next one — e.g. scrolling to the bottom of
 * "/" and clicking "App" opened /app already scrolled to its bottom.
 *
 * Reset to top on every path change, before paint. WelcomePage's own
 * anchor-scroll effect (keyed on `location.state`, not `pathname`) still
 * runs after this and can override it to land on a specific section.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    // Bug reports list the pages visited before Report was opened.
    noteRoute(pathname);
  }, [pathname]);

  return null;
}
