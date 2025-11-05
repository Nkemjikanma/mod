import { Filter } from "bad-words";
import type { BotHandler } from "@towns-protocol/bot";
import {
  addInfraction,
  incrementWarning,
  getMember,
  getTown,
  addLabel,
} from "../db/index";

const filter = new Filter();

export async function checkProfanity(
  handler: BotHandler,
  townId: string,
  userId: string,
  message: string,
  eventId: string,
  channelId: string,
  spaceId: string,
) {
  if (!filter.isProfane(message)) return null;

  // Delete the message containing profanity
  try {
    await handler.redact(spaceId, eventId, "Profanity detected");
    console.log(`[MOD] Deleted profane message ${eventId} from ${userId}`);
  } catch (err) {
    console.error(`[MOD] Failed to delete profane message:`, err);
  }

  const timestamp = Date.now();
  addInfraction(townId, userId, {
    type: "profanity",
    message,
    timestamp,
    messageId: eventId,
  });
  incrementWarning(townId, userId);

  const member = getMember(townId, userId);
  const town = getTown(townId);

  if (
    member.warnings >= town.settings.warnAfter &&
    !member.labels.includes("needs-review")
  ) {
    addLabel(townId, userId, "needs-review");
  }

  return member;
}
