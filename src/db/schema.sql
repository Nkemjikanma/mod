CREATE TABLE IF NOT EXISTS towns (
    town_id TEXT PRIMARY KEY,
    profanity_filter INTEGER DEFAULT 1,
    auto_warn INTEGER DEFAULT 1,
    warn_after INTEGER DEFAULT 3,
    spam_detection INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    town_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    warnings INTEGER DEFAULT 0,
    labels TEXT DEFAULT '[]',
    FOREIGN KEY (town_id) REFERENCES towns (town_id)
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
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_town_user ON members (town_id, user_id);

CREATE INDEX IF NOT EXISTS idx_infractions_lookup ON infractions (town_id, user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_welcome_messages_lookup ON welcome_messages (space_id, channel_id);

-- Unique constraint for members
CREATE UNIQUE INDEX IF NOT EXISTS unique_town_member ON members (town_id, user_id);
