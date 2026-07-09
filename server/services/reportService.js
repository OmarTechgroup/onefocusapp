// Bilans: turns raw checkins/focus_sessions/tasks into a 0-100 daily score and
// a reconstructed timeline, then caches the result in `reports` so past days
// stay readable offline without recomputing. "Today" is always recomputed live
// since its data is still partial ("temps non tracé" is shown honestly rather
// than guessed).
const { randomUUID: uuid } = require('crypto');
const db = require('../db');
const quoteService = require('./quoteService');

// --- Score formula (documented + adjustable in one place) ---------------
// score = 40 * oneThingDone
//       + 25 * focusRatio        (productive checkin-minutes / tracked checkin-minutes; 0.5 if untracked)
//       + 20 * checkinRate       (answered slots / expected slots so far; 1 if Challenge mode is off)
//       + 15 * taskCompletionRatio (done / (done + missed) among today's tasks; 1 if none due)
const WEIGHTS = { oneThing: 40, focusRatio: 25, checkinRate: 20, taskCompletion: 15 };

function getSettings() {
  const user = db.get('SELECT * FROM users LIMIT 1');
  return user ? JSON.parse(user.settings_json || '{}') : {};
}

function dayBounds(dateStr) {
  return { start: `${dateStr}T00:00:00.000Z`, end: `${dateStr}T23:59:59.999Z` };
}

function getDayTimeline(dateStr) {
  return db.all(
    `SELECT c.*, cat.name as category_name, cat.color as category_color, cat.icon as category_icon, cat.is_productive
     FROM checkins c LEFT JOIN categories cat ON cat.id = c.category_id
     WHERE substr(c.timestamp,1,10) = @date ORDER BY c.timestamp`,
    { date: dateStr }
  );
}

function computeCheckinStats(dateStr, timeline, settings, now = new Date()) {
  const challenge = settings.challenge || { enabled: false, intervalMinutes: 15, startHour: 8, endHour: 19 };
  if (!challenge.enabled) {
    // Challenge mode off: no expected-slot grid, so rate is neutral (doesn't
    // punish the score) and category minutes are estimated per check-in as
    // one interval each, purely for the category breakdown chart.
    const minutes = challenge.intervalMinutes || 15;
    const productive = timeline.filter((c) => c.is_productive).length * minutes;
    const distraction = timeline.filter((c) => c.category_id && !c.is_productive).length * minutes;
    return { checkinRate: 1, focusMinutes: productive, distractionMinutes: distraction, expectedSlots: 0, filledSlots: timeline.length };
  }

  const today = dateStr === now.toISOString().slice(0, 10);
  let cursor = new Date(`${dateStr}T${String(challenge.startHour).padStart(2, '0')}:00:00`);
  const dayEnd = new Date(`${dateStr}T${String(challenge.endHour).padStart(2, '0')}:00:00`);
  const boundary = today ? now : dayEnd;
  const intervalMs = (challenge.intervalMinutes || 15) * 60000;

  let expectedSlots = 0;
  let filledSlots = 0;
  let productiveMinutes = 0;
  let distractionMinutes = 0;

  while (cursor < dayEnd) {
    const slotEnd = new Date(cursor.getTime() + intervalMs);
    if (cursor <= boundary) {
      expectedSlots += 1;
      const match = timeline.find((c) => {
        const t = new Date(c.timestamp);
        return t >= cursor && t < slotEnd;
      });
      if (match) {
        filledSlots += 1;
        if (match.category_id) {
          if (match.is_productive) productiveMinutes += challenge.intervalMinutes;
          else distractionMinutes += challenge.intervalMinutes;
        }
      }
    }
    cursor = slotEnd;
  }

  return {
    checkinRate: expectedSlots ? filledSlots / expectedSlots : 1,
    focusMinutes: productiveMinutes,
    distractionMinutes,
    expectedSlots,
    filledSlots,
  };
}

function computeDailyData(dateStr) {
  const settings = getSettings();
  const timeline = getDayTimeline(dateStr);
  const checkinStats = computeCheckinStats(dateStr, timeline, settings);

  const oneThing = db.get(
    `SELECT * FROM tasks WHERE is_one_thing = 1 AND one_thing_date = @date`,
    { date: dateStr }
  );
  const oneThingDone = oneThing ? oneThing.status === 'done' : false;

  const tasksToday = db.all(
    `SELECT * FROM tasks WHERE due_date = @date OR substr(completed_at,1,10) = @date`,
    { date: dateStr }
  );
  const tasksDone = tasksToday.filter((t) => t.status === 'done').length;
  const tasksMissed = tasksToday.filter((t) => t.status === 'missed').length;
  const taskCompletionRatio = tasksDone + tasksMissed > 0 ? tasksDone / (tasksDone + tasksMissed) : 1;

  const sessions = db.all(
    `SELECT * FROM focus_sessions WHERE substr(started_at,1,10) = @date`,
    { date: dateStr }
  );
  const totalInterruptions = sessions.reduce((sum, s) => sum + (s.interruptions || 0), 0);
  const totalActualMinutes = sessions.reduce((sum, s) => sum + (s.actual_minutes || 0), 0);

  const trackedMinutes = checkinStats.focusMinutes + checkinStats.distractionMinutes;
  const focusRatio = trackedMinutes > 0 ? checkinStats.focusMinutes / trackedMinutes : 0.5;

  const score = Math.round(
    WEIGHTS.oneThing * (oneThingDone ? 1 : 0) +
    WEIGHTS.focusRatio * focusRatio +
    WEIGHTS.checkinRate * checkinStats.checkinRate +
    WEIGHTS.taskCompletion * taskCompletionRatio
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    oneThing: oneThing ? { id: oneThing.id, title: oneThing.title, done: oneThingDone } : null,
    tasks: { done: tasksDone, missed: tasksMissed, total: tasksToday.length },
    focus: {
      sessions: sessions.length,
      actualMinutes: totalActualMinutes,
      interruptions: totalInterruptions,
      completed: sessions.filter((s) => s.completed).length,
    },
    checkins: {
      rate: Math.round(checkinStats.checkinRate * 100),
      expectedSlots: checkinStats.expectedSlots,
      filledSlots: checkinStats.filledSlots,
      focusMinutes: checkinStats.focusMinutes,
      distractionMinutes: checkinStats.distractionMinutes,
      untracked: checkinStats.expectedSlots > 0 && checkinStats.expectedSlots > checkinStats.filledSlots,
    },
    timeline: timeline.map((c) => ({
      id: c.id,
      timestamp: c.timestamp,
      content: c.content,
      category_name: c.category_name,
      category_color: c.category_color,
      category_icon: c.category_icon,
    })),
    quote: quoteService.getRandomQuote(),
  };
}

function upsertReport(period, periodKey, score, data) {
  const existing = db.get('SELECT * FROM reports WHERE period = @period AND period_key = @periodKey', { period, periodKey });
  const now = new Date().toISOString();
  if (existing) {
    db.run('UPDATE reports SET score = @score, data_json = @data, generated_at = @now WHERE id = @id', {
      id: existing.id, score, data: JSON.stringify(data), now,
    });
    return db.get('SELECT * FROM reports WHERE id = @id', { id: existing.id });
  }
  const id = uuid();
  db.run(
    `INSERT INTO reports (id, period, period_key, score, data_json, generated_at) VALUES (@id,@period,@periodKey,@score,@data,@now)`,
    { id, period, periodKey, score, data: JSON.stringify(data), now }
  );
  return db.get('SELECT * FROM reports WHERE id = @id', { id });
}

function isPastDay(dateStr) {
  return dateStr < new Date().toISOString().slice(0, 10);
}

// Past days are immutable once generated (cached); today is always recomputed
// live so the score reflects check-ins/tasks as they happen.
function getDailyReport(dateStr) {
  if (isPastDay(dateStr)) {
    const cached = db.get('SELECT * FROM reports WHERE period = @p AND period_key = @k', { p: 'day', k: dateStr });
    if (cached) return { ...cached, data_json: JSON.parse(cached.data_json) };
  }
  const data = computeDailyData(dateStr);
  const row = upsertReport('day', dateStr, data.score, data);
  return { ...row, data_json: data };
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getComparison(dateStr) {
  const yesterday = getDailyReport(addDays(dateStr, -1));
  const last7 = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(dateStr, -i);
    const cached = db.get('SELECT score FROM reports WHERE period = @p AND period_key = @k', { p: 'day', k: d });
    if (cached) last7.push(cached.score);
  }
  const avg7 = last7.length ? Math.round(last7.reduce((a, b) => a + b, 0) / last7.length) : null;
  return { yesterdayScore: yesterday.score, avg7Days: avg7 };
}

function getWeeklyReport(mondayDateStr) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(mondayDateStr, i));
  const dailies = days.map((d) => getDailyReport(d));
  const scores = dailies.map((d) => d.score);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const categoryTotals = {};
  for (const day of dailies) {
    for (const entry of day.data_json.timeline) {
      if (!entry.category_name) continue;
      categoryTotals[entry.category_name] = (categoryTotals[entry.category_name] || 0) + 1;
    }
  }
  const dominantCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const best = dailies.reduce((a, b) => (b.score > a.score ? b : a));
  const worst = dailies.reduce((a, b) => (b.score < a.score ? b : a));

  const data = {
    days: dailies.map((d, i) => ({ date: days[i], score: d.score })),
    avgScore,
    dominantCategory,
    bestDay: { date: best.period_key, score: best.score },
    worstDay: { date: worst.period_key, score: worst.score },
    oneThingStreak: dailies.filter((d) => d.data_json.oneThing?.done).length,
  };
  const row = upsertReport('week', mondayDateStr, avgScore, data);
  return { ...row, data_json: data };
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// Month report only computes days up to "today" (never forces future days into
// existence) — a month in progress gets an honest partial picture, same
// principle as the daily "temps non tracé" handling.
function getMonthlyReport(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const today = new Date().toISOString().slice(0, 10);
  const total = daysInMonth(year, month);
  const dateStrs = [];
  for (let d = 1; d <= total; d++) {
    const dateStr = `${monthKey}-${String(d).padStart(2, '0')}`;
    if (dateStr <= today) dateStrs.push(dateStr);
  }

  if (!dateStrs.length) {
    const data = { days: [], avgScore: null, heatmap: [], records: null, goalsProgress: [] };
    const row = upsertReport('month', monthKey, 0, data);
    return { ...row, data_json: data };
  }

  const dailies = dateStrs.map((d) => getDailyReport(d));
  const scores = dailies.map((d) => d.score);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const bestScoreDay = dailies.reduce((a, b) => (b.score > a.score ? b : a));
  const mostFocusedDay = dailies.reduce((a, b) => (b.data_json.focus.actualMinutes > a.data_json.focus.actualMinutes ? b : a));

  const monthGoals = db.all(`SELECT * FROM goals WHERE level = 'month'`);
  const goalsProgress = monthGoals.map((g) => {
    const tasks = db.all(`SELECT status FROM tasks WHERE goal_id = @id`, { id: g.id });
    const done = tasks.filter((t) => t.status === 'done').length;
    return { id: g.id, title: g.title, done, total: tasks.length, ratio: tasks.length ? done / tasks.length : 0 };
  });

  const data = {
    days: dailies.map((d, i) => ({ date: dateStrs[i], score: d.score })),
    avgScore,
    records: {
      bestScoreDay: { date: bestScoreDay.period_key, score: bestScoreDay.score },
      mostFocusedDay: { date: mostFocusedDay.period_key, minutes: mostFocusedDay.data_json.focus.actualMinutes },
    },
    goalsProgress,
    oneThingDoneCount: dailies.filter((d) => d.data_json.oneThing?.done).length,
    daysTracked: dailies.length,
  };
  const row = upsertReport('month', monthKey, avgScore, data);
  return { ...row, data_json: data };
}

// Year in review: reads already-cached daily reports rather than forcing a
// year's worth of generation — by design only days that actually happened
// (and were viewed/finalized) have a cached row.
function getYearlyReport(yearKey) {
  const rows = db.all(
    `SELECT * FROM reports WHERE period = 'day' AND period_key LIKE @pattern ORDER BY period_key`,
    { pattern: `${yearKey}-%` }
  );
  const dailies = rows.map((r) => ({ ...r, data_json: JSON.parse(r.data_json) }));

  if (!dailies.length) {
    const data = { totalFocusedHours: 0, missionsCompleted: 0, monthly: [], highlights: [] };
    const row = upsertReport('year', yearKey, 0, data);
    return { ...row, data_json: data };
  }

  const totalFocusedMinutes = dailies.reduce((sum, d) => sum + (d.data_json.focus?.actualMinutes || 0), 0);
  const missionsCompleted = db.get(
    `SELECT COUNT(*) as n FROM missions WHERE status = 'completed' AND substr(created_at,1,4) = @year`,
    { year: yearKey }
  ).n;

  const byMonth = {};
  for (const d of dailies) {
    const monthKey = d.period_key.slice(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(d.score);
  }
  const monthly = Object.entries(byMonth).map(([monthKey, scores]) => ({
    month: monthKey,
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));

  const highlights = [...dailies]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((d) => ({ date: d.period_key, score: d.score, oneThing: d.data_json.oneThing?.title || null }));

  const avgScore = Math.round(dailies.reduce((sum, d) => sum + d.score, 0) / dailies.length);
  const data = {
    totalFocusedHours: Math.round((totalFocusedMinutes / 60) * 10) / 10,
    missionsCompleted,
    monthly,
    highlights,
    daysTracked: dailies.length,
  };
  const row = upsertReport('year', yearKey, avgScore, data);
  return { ...row, data_json: data };
}

module.exports = {
  computeDailyData,
  getDailyReport,
  getComparison,
  getWeeklyReport,
  getMonthlyReport,
  getYearlyReport,
};
