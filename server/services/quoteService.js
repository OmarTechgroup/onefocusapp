// "Texte du jour": a quote assigned once per calendar day and persisted in
// quote_history — that table IS the state (today's pick + this month's
// used-pool), so refreshing or opening on another device always sees the
// same quote, with no separate "shuffle queue" structure needed.
const { randomUUID: uuid } = require('crypto');
const db = require('../db');

function getSettings() {
  const user = db.get('SELECT * FROM users LIMIT 1');
  return user ? JSON.parse(user.settings_json || '{}') : {};
}

// Favorites get picked ~3x as often when the user opts in, by literally
// repeating them in the candidate pool before a uniform random pick.
function weightedPick(candidates, preferFavorites) {
  if (!candidates.length) return null;
  if (!preferFavorites) return candidates[Math.floor(Math.random() * candidates.length)];
  const weighted = candidates.flatMap((q) => (q.is_favorite ? [q, q, q] : [q]));
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function quoteWithHistoryRow(quote, shownDate) {
  const existing = db.get('SELECT id FROM quote_history WHERE shown_date = @shownDate', { shownDate });
  if (existing) return; // race-safe: another request already assigned today
  db.run('INSERT INTO quote_history (id, quote_id, shown_date) VALUES (@id,@quoteId,@shownDate)', {
    id: uuid(), quoteId: quote.id, shownDate,
  });
}

function getTodayQuote(dateStr = new Date().toISOString().slice(0, 10)) {
  const existing = db.get(
    `SELECT q.* FROM quote_history qh JOIN quotes q ON q.id = qh.quote_id WHERE qh.shown_date = @date`,
    { date: dateStr }
  );
  if (existing) return existing;

  const activePool = db.all('SELECT * FROM quotes WHERE is_active = 1');
  if (!activePool.length) return null;

  const monthKey = dateStr.slice(0, 7);
  const usedThisMonth = db.all(
    `SELECT quote_id FROM quote_history WHERE shown_date LIKE @pattern`,
    { pattern: `${monthKey}%` }
  ).map((r) => r.quote_id);

  let candidates = activePool.filter((q) => !usedThisMonth.includes(q.id));
  // Pool exhausted (or smaller than days-in-month, e.g. user deactivated most
  // quotes) — allow repeats again, starting a fresh cycle from the full pool.
  if (!candidates.length) candidates = activePool;

  const preferFavorites = !!getSettings().quotesPreferFavorites;
  const picked = weightedPick(candidates, preferFavorites);
  quoteWithHistoryRow(picked, dateStr);
  return picked;
}

// For focus-summary / daily-report "short quote" slots — any active quote,
// no history/no-repeat constraint (these aren't "the" quote of the day).
function getRandomQuote() {
  const pool = db.all('SELECT * FROM quotes WHERE is_active = 1');
  if (!pool.length) return null;
  const preferFavorites = !!getSettings().quotesPreferFavorites;
  return weightedPick(pool, preferFavorites);
}

// Evening notification quote: deliberately drawn from a separate pool that
// isn't part of the user's 80-quote seed/CRUD, per the user's explicit ask.
let eveningQuotes = null;
function getEveningQuote() {
  if (!eveningQuotes) {
    eveningQuotes = require('../seeds/evening-quotes.json');
  }
  return eveningQuotes[Math.floor(Math.random() * eveningQuotes.length)];
}

module.exports = { getTodayQuote, getRandomQuote, getEveningQuote };
