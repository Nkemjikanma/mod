import { Database } from "bun:sqlite";
import { isAdmin } from "../utils/permissions";
import { db, getTown } from "../db/index";
import { CommandContext } from "../types";
import { BotHandler } from "@towns-protocol/bot";

export async function handleMuteLabel(
  handler: BotHandler,
  { channelId, args, spaceId, userId }: CommandContext,
) {
  const label = args?.[0];
  if (!label) {
    await handler.sendMessage(channelId, "Usage: /mod mute-label <label>");
    return;
  }

  if (!(await isAdmin(handler, spaceId, userId))) {
    await handler.sendMessage(
      channelId,
      "⛔ Only admins or moderators can use this command.",
      { ephemeral: true },
    );
    return;
  }

  const members = db
    .query("SELECT user_id, labels FROM members WHERE town_id = ?")
    .all(spaceId) as { user_id: string; labels: string }[];

  const toMute = members.filter((m) => {
    try {
      const labels = JSON.parse(m.labels || "[]");
      return labels.includes(label);
    } catch {
      return false;
    }
  });

  if (toMute.length === 0) {
    await handler.sendMessage(
      channelId,
      `No users found with label "${label}".`,
    );
    return;
  }

  for (const m of toMute) {
    try {
      await handler.ban(m.user_id, spaceId);
    } catch (err) {
      console.error("Failed to mute user", m.user_id, err);
    }
  }

  await handler.sendMessage(
    channelId,
    `🔇 Muted ${toMute.length} user(s) labeled "${label}".`,
  );
}
