// node-cron jobs: "the scheduler is the only thing that actually looks at the
// clock" — everything here is idempotent against DB flags (missed status,
// time_blocks.notified) except the two minute-precision reminders (morning/
// evening/challenge check-ins), which are fine to dedupe in-memory since this
// is a single-process, single-user app that restarts rarely.
const cron = require('node-cron');
const db = require('../db');
const taskService = require('../services/taskService');
const reportService = require('../services/reportService');
const quoteService = require('../services/quoteService');
const { sendToUser } = require('../fcm/send');

function getSettings() {
  const user = db.get('SELECT * FROM users LIMIT 1');
  if (!user) return null;
  return { user, settings: JSON.parse(user.settings_json || '{}') };
}

function pad(n) {
  return String(n).padStart(2, '0');
}
function nowHM(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function checkMissedTasks() {
  const toMiss = db.all(
    `SELECT id, title FROM tasks WHERE status IN ('todo','active') AND (
       (due_date IS NOT NULL AND due_date < @today)
       OR id IN (SELECT task_id FROM time_blocks WHERE (date || 'T' || end_time) < @nowIso)
     )`,
    { today: todayKey(), nowIso: new Date().toISOString().slice(0, 16) }
  );
  if (!toMiss.length) return;
  const ids = taskService.markOverdueTasksMissed();
  for (const t of toMiss) {
    if (!ids.includes(t.id)) continue;
    await sendToUser({
      title: '⚠️ Tu as raté : ' + t.title,
      body: 'Reporte-la ou fais-la maintenant.',
      data: { type: 'task_missed', task_id: t.id },
      clickAction: `/missions?task=${t.id}`,
    });
  }
}

async function checkTimeBlockStarts() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 5 * 60 * 1000);
  const blocks = db.all(
    `SELECT tb.*, t.title as task_title FROM time_blocks tb
     JOIN tasks t ON t.id = tb.task_id
     WHERE tb.notified = 0 AND (tb.date || 'T' || tb.start_time) BETWEEN @from AND @to`,
    { from: now.toISOString().slice(0, 16), to: windowEnd.toISOString().slice(0, 16) }
  );
  for (const b of blocks) {
    await sendToUser({
      title: "C'est l'heure de : " + b.task_title,
      body: `Bloc prévu de ${b.start_time} à ${b.end_time}`,
      data: { type: 'time_block_start', task_id: b.task_id, time_block_id: b.id },
      clickAction: `/focus/${b.task_id}`,
    });
    db.run('UPDATE time_blocks SET notified = 1 WHERE id = @id', { id: b.id });
  }
}

// In-memory dedupe state for minute-precision, once-a-day/once-per-interval prompts.
const lastSent = { morning: null, evening: null, checkin: 0 };

async function checkDailyReminders() {
  const ctx = getSettings();
  if (!ctx) return;
  const { settings } = ctx;
  const hm = nowHM();
  const today = todayKey();

  if (settings.morningReminderTime === hm && lastSent.morning !== today) {
    const oneThing = db.get(
      `SELECT title FROM tasks WHERE is_one_thing = 1 AND one_thing_date = @today`,
      { today }
    );
    lastSent.morning = today;
    const quote = quoteService.getTodayQuote(today);
    const quoteSuffix = quote ? ` — 💬 ${quote.text}` : '';
    await sendToUser({
      title: '☀️ Bonjour !',
      body: (oneThing ? `Ta ONE Thing aujourd'hui : ${oneThing.title}` : 'Quelle sera ta ONE Thing aujourd\'hui ?') + quoteSuffix,
      data: { type: 'morning', quote: quote?.text || '' },
      clickAction: '/',
    });
  }

  if (settings.eveningReminderTime === hm && lastSent.evening !== today) {
    lastSent.evening = today;
    const report = reportService.getDailyReport(today);
    // Deliberately not one of the 80 seeded quotes — a distinct evening/reflection pool.
    const eveningQuote = quoteService.getEveningQuote();
    await sendToUser({
      title: `🌙 Bilan du jour — score ${report.score}/100`,
      body: `Ta journée en un coup d'œil — et quelle sera ta ONE Thing demain ?\n💬 ${eveningQuote.text}`,
      data: { type: 'evening', quote: eveningQuote.text },
      clickAction: '/stats',
    });
  }
}

async function checkChallengeCheckin() {
  const ctx = getSettings();
  if (!ctx) return;
  const { settings } = ctx;
  const challenge = settings.challenge;
  if (!challenge?.enabled) return;

  const now = new Date();
  const hour = now.getHours();
  if (hour < challenge.startHour || hour >= challenge.endHour) return;

  const intervalMs = (challenge.intervalMinutes || 15) * 60 * 1000;
  if (Date.now() - lastSent.checkin < intervalMs) return;

  // Skip while a focus session explicitly asked not to be interrupted.
  const activeDnd = db.get(
    `SELECT id FROM focus_sessions WHERE ended_at IS NULL AND do_not_disturb = 1`
  );
  if (activeDnd) return;

  lastSent.checkin = Date.now();
  await sendToUser({
    title: '⏱️ Check-in !',
    body: "Qu'as-tu fait ces dernières minutes ?",
    data: { type: 'checkin' },
    clickAction: '/capture',
  });
}

function start() {
  // Every 5 minutes: DB-flag-backed jobs (safe even if a tick is missed).
  cron.schedule('*/5 * * * *', () => {
    checkMissedTasks().catch((e) => console.error('[scheduler] checkMissedTasks failed:', e));
    checkTimeBlockStarts().catch((e) => console.error('[scheduler] checkTimeBlockStarts failed:', e));
  });

  // Every minute: minute-precision prompts (morning/evening/challenge check-ins).
  cron.schedule('* * * * *', () => {
    checkDailyReminders().catch((e) => console.error('[scheduler] checkDailyReminders failed:', e));
    checkChallengeCheckin().catch((e) => console.error('[scheduler] checkChallengeCheckin failed:', e));
  });

  // Just after midnight: freeze yesterday's report now that the day is complete,
  // and record its streak point (ONE Thing done + check-in rate) for the 66-day heatmap.
  cron.schedule('5 0 * * *', () => {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const report = reportService.getDailyReport(yesterday);
      const oneThingDone = report.data_json.oneThing?.done ? 1 : 0;
      const checkinRate = (report.data_json.checkins.rate || 0) / 100;
      const existing = db.get('SELECT id FROM streaks WHERE date = @date', { date: yesterday });
      if (existing) {
        db.run('UPDATE streaks SET one_thing_done = @done, checkin_rate = @rate WHERE id = @id', {
          id: existing.id, done: oneThingDone, rate: checkinRate,
        });
      } else {
        db.run('INSERT INTO streaks (id, date, one_thing_done, checkin_rate) VALUES (@id,@date,@done,@rate)', {
          id: require('crypto').randomUUID(), date: yesterday, done: oneThingDone, rate: checkinRate,
        });
      }
    } catch (e) {
      console.error('[scheduler] daily report finalization failed:', e);
    }
  });

  console.log('[scheduler] started (5-min: missed tasks + time blocks · 1-min: reminders + check-ins)');
}

module.exports = { start, checkMissedTasks, checkTimeBlockStarts, checkDailyReminders, checkChallengeCheckin };
