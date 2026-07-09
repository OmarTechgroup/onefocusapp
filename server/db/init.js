// npm run db:init — creates schema + seeds realistic demo data so the
// reports/bilans screens have something to show immediately.
const { randomUUID: uuid } = require('crypto');
const db = require('./index');
const defaultQuotes = require('../seeds/quotes.json');

db.migrate();

const now = new Date();
const iso = (d) => d.toISOString();
const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
const dateKey = (d) => d.toISOString().slice(0, 10);

function seed() {
  const userId = uuid();
  db.run(
    `INSERT INTO users (id, name, settings_json) VALUES (@id, @name, @settings)`,
    { id: userId, name: 'Adrien', settings: JSON.stringify({
      pomodoro: { focusMinutes: 25, breakMinutes: 5 },
      challenge: { enabled: true, intervalMinutes: 15, startHour: 8, endHour: 19 },
      remindBeforeMinutes: 30,
      morningReminderTime: '07:30',
      eveningReminderTime: '21:00',
      theme: 'dark',
    }) }
  );

  const categories = [
    { name: 'Travail client', color: '#F59E0B', icon: 'briefcase', productive: 1 },
    { name: 'Dev perso', color: '#22D3EE', icon: 'code', productive: 1 },
    { name: 'Admin/Emails', color: '#A78BFA', icon: 'mail', productive: 1 },
    { name: 'Apprentissage', color: '#34D399', icon: 'book', productive: 1 },
    { name: 'Pause', color: '#94A3B8', icon: 'coffee', productive: 0 },
    { name: 'Distraction', color: '#F87171', icon: 'smartphone', productive: 0 },
    { name: 'Sport', color: '#38BDF8', icon: 'dumbbell', productive: 1 },
    { name: 'Perso', color: '#FB923C', icon: 'user', productive: 0 },
  ].map((c) => ({ id: uuid(), ...c }));

  for (const c of categories) {
    db.run(
      `INSERT INTO categories (id, name, color, icon, is_productive) VALUES (@id, @name, @color, @icon, @productive)`,
      c
    );
  }

  const goalYear = uuid();
  db.run(`INSERT INTO goals (id, level, title, deadline) VALUES (@id,'year',@title,@deadline)`, {
    id: goalYear, title: 'Lancer mon activité freelance', deadline: dateKey(daysAgo(-180)),
  });
  const goalMonth = uuid();
  db.run(`INSERT INTO goals (id, level, title, parent_goal_id, deadline) VALUES (@id,'month',@title,@parent,@deadline)`, {
    id: goalMonth, title: 'Livrer le MVP client X', parent: goalYear, deadline: dateKey(daysAgo(-20)),
  });
  const goalWeek = uuid();
  db.run(`INSERT INTO goals (id, level, title, parent_goal_id, deadline) VALUES (@id,'week',@title,@parent,@deadline)`, {
    id: goalWeek, title: 'Finir le module de facturation', parent: goalMonth, deadline: dateKey(daysAgo(-3)),
  });

  const mission = uuid();
  db.run(
    `INSERT INTO missions (id, title, description, goal_id, color, status) VALUES (@id,@title,@description,@goal,@color,'active')`,
    { id: mission, title: 'Projet OneFocus', description: 'Construire l\'app OneFocus', goal: goalMonth, color: '#F59E0B' }
  );

  const taskOneThing = uuid();
  db.run(
    `INSERT INTO tasks (id, mission_id, goal_id, title, description, due_date, quadrant, status, estimated_minutes, is_one_thing, one_thing_date, tags_json)
     VALUES (@id,@mission,@goal,@title,@description,@due,'urgent_important','todo',90,1,@oneThingDate,'[]')`,
    { id: taskOneThing, mission, goal: goalWeek, title: 'Finaliser le module de facturation', description: 'Écrans + API', due: dateKey(now), oneThingDate: dateKey(now) }
  );
  const steps = ['Modèle de données', 'API endpoints', 'UI formulaire', 'Tests'];
  steps.forEach((title, i) => {
    db.run(`INSERT INTO steps (id, task_id, title, "order", done, done_at) VALUES (@id,@task,@title,@order,@done,@doneAt)`, {
      id: uuid(), task: taskOneThing, title, order: i, done: i === 0 ? 1 : 0, doneAt: i === 0 ? iso(now) : null,
    });
  });

  const otherTasks = [
    { title: 'Répondre aux emails clients', quadrant: 'urgent', status: 'todo', minutes: 20 },
    { title: 'Faire du sport', quadrant: 'important', status: 'todo', minutes: 45 },
    { title: 'Ranger le bureau', quadrant: 'neither', status: 'someday', minutes: 15 },
    { title: 'Préparer la présentation trimestrielle', quadrant: 'important', status: 'todo', minutes: 60 },
  ];
  for (const t of otherTasks) {
    db.run(
      `INSERT INTO tasks (id, mission_id, title, quadrant, status, estimated_minutes, due_date, tags_json)
       VALUES (@id,@mission,@title,@quadrant,@status,@minutes,@due,'[]')`,
      { id: uuid(), mission, title: t.title, quadrant: t.quadrant, status: t.status, minutes: t.minutes, due: dateKey(now) }
    );
  }

  // Demo check-ins + focus sessions over the last 7 days for reports
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const day = daysAgo(dayOffset);
    const dayStr = dateKey(day);
    let responded = 0;
    let total = 0;
    for (let hour = 8; hour < 19; hour++) {
      for (const minute of [0, 15, 30, 45]) {
        total++;
        const missed = Math.random() < 0.15;
        const ts = new Date(day);
        ts.setHours(hour, minute, 0, 0);
        if (!missed) {
          responded++;
          const cat = categories[Math.floor(Math.random() * categories.length)];
          db.run(
            `INSERT INTO checkins (id, timestamp, content, input_mode, category_id, missed) VALUES (@id,@ts,@content,@mode,@cat,0)`,
            { id: uuid(), ts: iso(ts), content: `Session de travail (${cat.name})`, mode: Math.random() > 0.5 ? 'voice' : 'text', cat: cat.id }
          );
        } else {
          db.run(`INSERT INTO checkins (id, timestamp, missed) VALUES (@id,@ts,1)`, { id: uuid(), ts: iso(ts) });
        }
      }
    }
    const oneThingDone = Math.random() < 0.7 ? 1 : 0;
    db.run(
      `INSERT INTO streaks (id, date, one_thing_done, checkin_rate) VALUES (@id,@date,@done,@rate)`,
      { id: uuid(), date: dayStr, done: oneThingDone, rate: responded / total }
    );

    const fsId = uuid();
    const started = new Date(day); started.setHours(9, 0, 0, 0);
    const ended = new Date(started); ended.setMinutes(ended.getMinutes() + 50);
    db.run(
      `INSERT INTO focus_sessions (id, task_id, started_at, ended_at, planned_minutes, actual_minutes, interruptions, completed)
       VALUES (@id,@task,@started,@ended,50,50,@interruptions,1)`,
      { id: fsId, task: taskOneThing, started: iso(started), ended: iso(ended), interruptions: Math.floor(Math.random() * 3) }
    );
  }

  for (const q of defaultQuotes) {
    db.run(
      `INSERT INTO quotes (id, text, author, category, is_custom) VALUES (@id,@text,@author,@category,0)`,
      { id: uuid(), text: q.text, author: q.author || null, category: q.category || null }
    );
  }

  console.log('Seed OK. User:', userId, `| ${defaultQuotes.length} default quotes imported`);
}

seed();
