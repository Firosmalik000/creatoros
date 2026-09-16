import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const localeFiles = ["id", "en", "ms"];

test("locale dictionaries expose the same top-level namespaces", async () => {
  const dictionaries = await Promise.all(
    localeFiles.map(async (locale) =>
      JSON.parse(
        await readFile(
          new URL(`../src/messages/${locale}.json`, import.meta.url),
        ),
      ),
    ),
  );
  const expected = Object.keys(dictionaries[0]).sort();
  for (const dictionary of dictionaries.slice(1)) {
    assert.deepEqual(Object.keys(dictionary).sort(), expected);
  }
});

test("locale dictionaries expose matching message keys", async () => {
  const dictionaries = await Promise.all(
    localeFiles.map(async (locale) =>
      JSON.parse(
        await readFile(
          new URL(`../src/messages/${locale}.json`, import.meta.url),
        ),
      ),
    ),
  );
  const flatten = (value, prefix = "") =>
    Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return child && typeof child === "object" ? flatten(child, path) : [path];
    });
  const expected = flatten(dictionaries[0]).sort();
  for (const dictionary of dictionaries.slice(1)) {
    assert.deepEqual(flatten(dictionary).sort(), expected);
  }
});
