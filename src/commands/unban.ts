import type { BotHandler } from "@towns-protocol/bot";
import { isAdmin } from "../utils/permissions";
import { addInfraction } from "../db/index";

export async function handleUnban(
  handler: BotHandler,
  {
    channelId,
    mentions,
    spaceId,
    userId,
  }: {
    channelId: string;
    mentions: any[];
    spaceId: string;
    userId: string;
  }
) {
  if (!(await isAdmin(handler, spaceId, userId))) {
    await handler.sendMessage(channelId, "⛔ Only admins can unban users.", {
      ephemeral: true,
    });
    return;
  }

  const targetUserId = mentions?.[0]?.userId;
  if (!targetUserId) {
    await handler.sendMessage(channelId, "Usage: /unban @user");
    return;
  }

  try {
    await handler.unban(targetUserId, spaceId);
    addInfraction(spaceId, targetUserId, {
      type: "unban",
      message: `Unbanned by ${userId}`,
      messageId: "",
      timestamp: Date.now(),
    });

    await handler.sendMessage(channelId, `✅ Unbanned <@${targetUserId}>`);
    console.log(`[MOD] ${userId} unbanned ${targetUserId}`);
  } catch (err) {
    console.error("Failed to unban user:", err);
    await handler.sendMessage(
      channelId,
      `❌ Failed to unban user. They may not be banned.`,
      { ephemeral: true }
    );
  }
}
