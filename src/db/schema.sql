CREATE TABLE IF NOT EXISTS towns (
  town_id TEXT PRIMARY KEY,
  profanity_filter INTEGER DEFAULT 1,
  auto_warn INTEGER DEFAULT 1,
  warn_after INTEGER DEFAULT 3
);

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  town_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  warnings INTEGER DEFAULT 0,
  labels TEXT DEFAULT '[]',
  FOREIGN KEY (town_id) REFERENCES towns(town_id)
);

CREATE TABLE IF NOT EXISTS infractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  town_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT,
  message TEXT,
  message_id TEXT,
  timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS welcome_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  space_id TEXT,
  channel_id TEXT,
  message_id TEXT
)
