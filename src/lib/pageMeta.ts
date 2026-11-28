import { useEffect } from 'react';

const SITE_URL = 'https://emerald-summit.vercel.app';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Sets this route's title, description, canonical and OG/Twitter tags.
 * `path` is the route's path (e.g. "/lineup") used to build the canonical
 * and og:url; every public route needs its own so crawlers and link
 * previews (which don't all run the prerendered JS) see distinct pages
 * instead of one shared "Emerald Summit" title everywhere.
 */
export function usePageMeta(opts: { title: string; description: string; path: string }) {
  const { title, description, path } = opts;
  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertLink('canonical', url);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
  }, [title, description, path]);
}

/** Injects one or more JSON-LD blocks into <head>, replacing any from a previous page. */
export function useJsonLd(blocks: Record<string, unknown>[]) {
  const json = JSON.stringify(blocks.length === 1 ? blocks[0] : blocks);
  useEffect(() => {
    document.querySelectorAll('script[data-page-jsonld]').forEach((el) => el.remove());
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.pageJsonld = 'true';
    script.textContent = json;
    document.head.appendChild(script);
    return () => script.remove();
  }, [json]);
}
