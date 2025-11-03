import { Filter } from "bad-words";
import {
  addInfraction,
  incrementWarning,
  getMember,
  getTown,
  addLabel,
} from "../db/index";

const filter = new Filter();

export async function checkProfanity(
  townId: string,
  userId: string,
  message: string,
  eventId: string,
) {
  if (!filter.isProfane(message)) return null;

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
