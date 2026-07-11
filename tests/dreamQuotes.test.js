const assert = require("node:assert/strict");
const test = require("node:test");

const DreamQuotes = require("../src/dreamQuotes");

test("contains a verified public-domain quote set", () => {
  assert.ok(DreamQuotes.quotes.length >= 8);
  assert.ok(DreamQuotes.quotes.length <= 12);
  DreamQuotes.quotes.forEach((quote) => {
    assert.equal(typeof quote.text, "string");
    assert.ok(quote.text.length > 0);
    assert.equal(typeof quote.author, "string");
    assert.ok(quote.author.length > 0);
    assert.match(quote.source, /^https:\/\//);
  });
});

test("keeps the daily quote stable for the same local date", () => {
  const morning = new Date(2026, 6, 12, 8, 0);
  const evening = new Date(2026, 6, 12, 23, 30);
  assert.deepEqual(
    DreamQuotes.getQuoteForDate(morning),
    DreamQuotes.getQuoteForDate(evening)
  );
});

test("uses a browser-local date key", () => {
  assert.equal(
    DreamQuotes.toLocalDateKey(new Date(2026, 6, 12, 23, 30)),
    "2026-07-12"
  );
});
