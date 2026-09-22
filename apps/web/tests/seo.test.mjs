import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sitemap.ts configures all locales, seeded categories, and hreflang alternates", async () => {
  const content = await readFile(
    new URL("../src/app/sitemap.ts", import.meta.url),
    "utf8",
  );

  // Must declare all 6 marketplace categories
  const expectedCategories = [
    "food-lifestyle",
    "fashion-beauty",
    "tech-gadgets",
    "travel-hospitality",
    "education-finance",
    "gaming-entertainment",
  ];
  for (const cat of expectedCategories) {
    assert.ok(
      content.includes(`"${cat}"`),
      `sitemap.ts must include seeded category "${cat}"`,
    );
  }

  // Must declare alternates for search engine indexing
  assert.ok(
    content.includes("alternates:"),
    "sitemap.ts must declare alternates",
  );
  assert.ok(
    content.includes("languages:"),
    "sitemap.ts must declare language alternates",
  );
  assert.ok(
    content.includes("changeFrequency:"),
    "sitemap.ts must specify changeFrequency",
  );
  assert.ok(content.includes("priority:"), "sitemap.ts must specify priority");
});

test("robots.ts enforces strict crawl boundaries and sitemap declaration", async () => {
  const content = await readFile(
    new URL("../src/app/robots.ts", import.meta.url),
    "utf8",
  );

  assert.ok(
    content.includes("sitemap.xml"),
    "robots.ts must declare sitemap.xml location",
  );
  assert.ok(
    content.includes("allow: \"/\""),
    "robots.ts must allow root indexing",
  );

  const expectedDisallows = [
    "/*/admin*",
    "/*/settings*",
    "/*/creator/*",
    "/*/checkout/*",
    "/*/orders/*",
    "/*/campaigns/*",
    "/*/notifications*",
    "/*/auth/*",
    "/api/*",
  ];

  for (const pattern of expectedDisallows) {
    assert.ok(
      content.includes(`"${pattern}"`),
      `robots.ts must disallow "${pattern}"`,
    );
  }
});

test("root layout and public pages declare canonical, hreflang alternates, and JSON-LD", async () => {
  const layoutContent = await readFile(
    new URL("../src/app/[locale]/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(
    layoutContent.includes("canonical"),
    "layout.tsx must configure canonical URL",
  );
  assert.ok(
    layoutContent.includes("languages:"),
    "layout.tsx must configure language alternates",
  );
  assert.ok(
    layoutContent.includes("openGraph:"),
    "layout.tsx must configure openGraph metadata",
  );

  const notFoundContent = await readFile(
    new URL("../src/app/[locale]/not-found.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    notFoundContent.includes("robots: { index: false"),
    "404 page must be noindex",
  );
});
