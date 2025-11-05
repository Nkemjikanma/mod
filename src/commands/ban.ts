import type { BotHandler } from "@towns-protocol/bot";
import { isAdmin } from "../utils/permissions";
import { addInfraction } from "../db/index";

export async function handleBan(
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
    await handler.sendMessage(channelId, "⛔ Only admins can ban users.", {
      ephemeral: true,
    });
    return;
  }

  const targetUserId = mentions?.[0]?.userId;
  if (!targetUserId) {
    await handler.sendMessage(channelId, "Usage: /ban @user [reason]");
    return;
  }

  const reason = args.slice(1).join(" ") || "No reason provided";

  try {
    await handler.ban(targetUserId, spaceId);
    addInfraction(spaceId, targetUserId, {
      type: "ban",
      message: reason,
      messageId: "",
      timestamp: Date.now(),
    });

    await handler.sendMessage(
      channelId,
      `🔨 Banned <@${targetUserId}>: ${reason}`
    );
    console.log(`[MOD] ${userId} banned ${targetUserId}: ${reason}`);
  } catch (err) {
    console.error("Failed to ban user:", err);
    await handler.sendMessage(
      channelId,
      `❌ Failed to ban user. They may already be banned or you lack permissions.`,
      { ephemeral: true }
    );
  }
}
