-- OneFocus schema (SQLite). Designed to be portable to PostgreSQL later:
-- - all ids are TEXT (uuid) so they map 1:1 to Postgres uuid/text
-- - booleans stored as INTEGER 0/1 (Postgres: boolean)
-- - json stored as TEXT (Postgres: jsonb)
-- - timestamps stored as TEXT ISO8601 (Postgres: timestamptz)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('someday','year','month','week')),
  title TEXT NOT NULL,
  parent_goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  deadline TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  color TEXT NOT NULL DEFAULT '#F59E0B',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  mission_id TEXT REFERENCES missions(id) ON DELETE CASCADE,
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  quadrant TEXT CHECK (quadrant IN ('urgent_important','important','urgent','neither')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','active','done','missed','abandoned','someday')),
  estimated_minutes INTEGER,
  is_one_thing INTEGER NOT NULL DEFAULT 0,
  one_thing_date TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  from_inbox INTEGER NOT NULL DEFAULT 0,
  reminded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT
);

CREATE TABLE IF NOT EXISTS time_blocks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  notified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  planned_minutes INTEGER NOT NULL,
  actual_minutes INTEGER,
  interruptions INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  do_not_disturb INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_productive INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  content TEXT,
  input_mode TEXT CHECK (input_mode IN ('voice','text')),
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  missed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL CHECK (period IN ('day','week','month','year')),
  period_key TEXT NOT NULL,
  score INTEGER,
  data_json TEXT NOT NULL DEFAULT '{}',
  generated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(period, period_key)
);

CREATE TABLE IF NOT EXISTS inbox_items (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  processed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_info TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS streaks (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  one_thing_done INTEGER NOT NULL DEFAULT 0,
  checkin_rate REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  author TEXT,
  category TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- One row per calendar day: this IS the persisted "quote of the day" state
-- (also used to derive "already shown this month" for the no-repeat shuffle),
-- so it's correct across refreshes and devices by construction.
CREATE TABLE IF NOT EXISTS quote_history (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  shown_date TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_mission ON tasks(mission_id);
CREATE INDEX IF NOT EXISTS idx_tasks_quadrant ON tasks(quadrant);
CREATE INDEX IF NOT EXISTS idx_steps_task ON steps(task_id);
CREATE INDEX IF NOT EXISTS idx_checkins_timestamp ON checkins(timestamp);
CREATE INDEX IF NOT EXISTS idx_time_blocks_date ON time_blocks(date);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task ON focus_sessions(task_id);
