import { Database } from "bun:sqlite";
import {
  TownProfile,
  MemberProfile,
  Infraction,
  TownSettings,
  WelcomeMessageDBType,
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
      "INSERT INTO towns (town_id, profanity_filter, auto_warn, warn_after) VALUES (?, ?, ?, ?)",
    ).run(townId, 1, 1, 3);
  }
}

export function getTown(townId: string): TownProfile {
  const row = db
    .query("SELECT * FROM towns WHERE town_id = ?")
    .get(townId) as TownProfile;
  const settings: TownSettings = row
    ? {
        profanityFilter: !!row.profanityFilter,
        autoWarn: !!row.autoWarn,
        warnAfter: row.warnAfter,
      }
    : {
        profanityFilter: true,
        autoWarn: true,
        warnAfter: 3,
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
  };
  const col = map[key];
  db.query(`UPDATE towns SET ${col} = ? WHERE town_id = ?`).run(value, townId);
}

// ---------- MEMBERS ----------
export function getMember(townId: string, userId: string): MemberProfile {
  let memberRow = db
    .query("SELECT * FROM members WHERE town_id = ? AND user_id = ?")
    .get(townId, userId) as MemberProfile;

  if (!memberRow) {
    db.query("INSERT INTO members (town_id, user_id) VALUES (?, ?)").run(
      townId,
      userId,
    );
    memberRow = db
      .query("SELECT * FROM members WHERE town_id = ? AND user_id = ?")
      .get(townId, userId) as MemberProfile;
  }

  return {
    userId,
    infractions: getInfractions(townId, userId),
    labels: JSON.parse(memberRow.labels.join(", ") || "[]"),
    warnings: memberRow.warnings || 0,
  };
}

export function incrementWarning(townId: string, userId: string) {
  const member = getMember(townId, userId);
  db.query(
    "UPDATE members SET warnings = ? WHERE town_id = ? AND user_id = ?",
  ).run(member.warnings + 1, townId, userId);
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
  return db
    .query(
      "SELECT * FROM infractions WHERE town_id = ? AND user_id = ? ORDER BY timestamp DESC",
    )
    .all(townId, userId) as Infraction[];
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
    .get(spaceId, channelId) as WelcomeMessageDBType;
  return row ? (row.messageId as string) : null;
}
