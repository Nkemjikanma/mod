import { Database } from "bun:sqlite";
import {
  TownProfile,
  MemberProfile,
  Infraction,
  TownSettings,
  WelcomeMessageDBType,
  TownDBRow,
} from "../types";

export const db = new Database("data/modbot.db");

// Initialize schema
db.run(await Bun.file("src/db/schema.sql").text());

// ---------- TOWNS ----------
export function ensureTown(townId: string) {
  const existing = db
    .query("SELECT * FROM towns WHERE town_id = ?")
    .get(townId);
  if (!existing) {
    db.query(
      "INSERT INTO towns (town_id, profanity_filter, auto_warn, warn_after, spam_detection) VALUES (?, ?, ?, ?, ?)",
    ).run(townId, 1, 1, 3, 1);
  }
}

export function getTown(townId: string): TownProfile {
  const row = db
    .query("SELECT * FROM towns WHERE town_id = ?")
    .get(townId) as TownDBRow | undefined;

  const settings: TownSettings = row
    ? {
        profanityFilter: !!row.profanity_filter,
        autoWarn: !!row.auto_warn,
        warnAfter: row.warn_after,
        spamDetection: !!row.spam_detection,
      }
    : {
        profanityFilter: true,
        autoWarn: true,
        warnAfter: 3,
        spamDetection: true,
      };

  return {
    townId,
    settings,
    members: {}, // will populate dynamically
  };
}

export function updateTownSetting(
  townId: string,
  key: keyof TownSettings,
  value: boolean | number,
) {
  const map: Record<keyof TownSettings, string> = {
    profanityFilter: "profanity_filter",
    autoWarn: "auto_warn",
    warnAfter: "warn_after",
    spamDetection: "spam_detection",
  };
  const col = map[key];
  db.query(`UPDATE towns SET ${col} = ? WHERE town_id = ?`).run(value, townId);
}

// ---------- MEMBERS ----------
export function getMember(townId: string, userId: string): MemberProfile {
  let memberRow = db
    .query("SELECT * FROM members WHERE town_id = ? AND user_id = ?")
    .get(townId, userId) as any;

  if (!memberRow) {
    db.query("INSERT OR IGNORE INTO members (town_id, user_id) VALUES (?, ?)").run(
      townId,
      userId,
    );
    memberRow = db
      .query("SELECT * FROM members WHERE town_id = ? AND user_id = ?")
      .get(townId, userId) as any;
  }

  return {
    userId,
    infractions: getInfractions(townId, userId),
    labels: JSON.parse((memberRow?.labels || "[]") as string),
    warnings: memberRow?.warnings || 0,
  };
}

export function incrementWarning(townId: string, userId: string) {
  const member = getMember(townId, userId);
  db.query(
    "UPDATE members SET warnings = ? WHERE town_id = ? AND user_id = ?",
  ).run(member.warnings + 1, townId, userId);
}

export function resetWarnings(townId: string, userId: string) {
  db.query(
    "UPDATE members SET warnings = 0 WHERE town_id = ? AND user_id = ?",
  ).run(townId, userId);
}

export function addInfraction(
  townId: string,
  userId: string,
  infraction: Omit<Infraction, "id">,
) {
  db.query(
    "INSERT INTO infractions (town_id, user_id, type, message, message_id, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    townId,
    userId,
    infraction.type,
    infraction.message,
    infraction.messageId,
    infraction.timestamp,
  );
}

export function getInfractions(townId: string, userId: string): Infraction[] {
  return (db
    .query(
      "SELECT * FROM infractions WHERE town_id = ? AND user_id = ? ORDER BY timestamp DESC",
    )
    .all(townId, userId) as any[]).map(row => ({
      id: row.id,
      type: row.type,
      message: row.message,
      messageId: row.message_id,
      timestamp: row.timestamp,
    }));
}

export function addLabel(townId: string, userId: string, label: string) {
  const member = getMember(townId, userId);
  if (!member.labels.includes(label)) {
    member.labels.push(label);
    db.query(
      "UPDATE members SET labels = ? WHERE town_id = ? AND user_id = ?",
    ).run(JSON.stringify(member.labels), townId, userId);
  }
}

export function removeLabel(townId: string, userId: string, label: string) {
  const member = getMember(townId, userId);
  const filtered = member.labels.filter(l => l !== label);
  db.query(
    "UPDATE members SET labels = ? WHERE town_id = ? AND user_id = ?",
  ).run(JSON.stringify(filtered), townId, userId);
}

export function saveWelcomeMessage(
  spaceId: string,
  channelId: string,
  messageId: string,
) {
  const insertStmt = db.prepare(`
    INSERT INTO welcome_messages (space_id, channel_id, message_id)
    VALUES (?, ?, ?)
  `);
  insertStmt.run(spaceId, channelId, messageId);

  // 🧹 Delete all older messages for this channel (keep only the latest)
  const cleanupStmt = db.prepare(`
    DELETE FROM welcome_messages
    WHERE space_id = ? AND channel_id = ? AND message_id != ?
  `);
  cleanupStmt.run(spaceId, channelId, messageId);
}

export function getWelcomeMessage(
  spaceId: string,
  channelId: string,
): string | null {
  const row = db
    .query(
      "SELECT message_id FROM welcome_messages WHERE space_id = ? AND channel_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(spaceId, channelId) as any;
  return row ? (row.message_id as string) : null;
}
