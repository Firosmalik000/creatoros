# SEO

Indexable public pages must provide localized titles and descriptions, canonical URLs, language alternates, Open Graph metadata, robots directives, and valid structured data derived from real or explicitly illustrative data.

Search/filter combinations are `noindex, follow` by default to avoid crawl traps. Curated category, niche, platform, and location landing pages may be indexed. Private, authentication, checkout, payment, message, and dashboard pages are not indexable.

The web app exposes `robots.txt` and a localized sitemap. Production must set the canonical origin explicitly.

Phase 2 public creator profiles are server-rendered only for verified creators and include localized title/description, canonical URL, `id-ID`/`en`/`ms-MY`/`x-default` alternates, Open Graph profile metadata, and `ProfilePage`/`Person` JSON-LD. Non-verified slugs return a real 404 and are not cached. Dynamic creator sitemap enumeration remains part of the directory/SEO phases.

Phase 3 adds a server-rendered creator directory and curated `/creators/category/{category}` landing pages. The base directory and category pages are indexable; arbitrary search, filter, sort, and pagination combinations are `noindex, follow` with a canonical pointing to the base directory.
The localized sitemap includes the directory and the seeded category landing pages; arbitrary query combinations are intentionally excluded.
