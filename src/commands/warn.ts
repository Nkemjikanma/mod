import type { BotHandler } from "@towns-protocol/bot";
import { isAdmin } from "../utils/permissions";
import { addInfraction, incrementWarning, getMember, addLabel } from "../db/index";

export async function handleWarn(
  handler: BotHandler,
  {
    channelId,
    mentions,
    args,
    spaceId,
    userId,
  }: {
    channelId: string;
    mentions: any[];
    args: string[];
    spaceId: string;
    userId: string;
  }
) {
  if (!(await isAdmin(handler, spaceId, userId))) {
    await handler.sendMessage(channelId, "⛔ Only admins can warn users.", {
      ephemeral: true,
    });
    return;
  }

  const targetUserId = mentions?.[0]?.userId;
  if (!targetUserId) {
    await handler.sendMessage(channelId, "Usage: /warn @user [reason]");
    return;
  }

  const reason = args.slice(1).join(" ") || "No reason provided";

  addInfraction(spaceId, targetUserId, {
    type: "manual_warn",
    message: reason,
    messageId: "",
    timestamp: Date.now(),
  });
  incrementWarning(spaceId, targetUserId);

  const member = getMember(spaceId, targetUserId);

  // Auto-label if threshold reached
  if (member.warnings >= 3 && !member.labels.includes("needs-review")) {
    addLabel(spaceId, targetUserId, "needs-review");
  }

  await handler.sendMessage(
    channelId,
    `⚠️ <@${targetUserId}> has been warned (${member.warnings}/3): ${reason}`
  );
  console.log(`[MOD] ${userId} warned ${targetUserId}: ${reason}`);
}
