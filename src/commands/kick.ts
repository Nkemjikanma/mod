import type { BotHandler } from "@towns-protocol/bot";
import { isAdmin } from "../utils/permissions";
import { addInfraction } from "../db/index";

export async function handleKick(
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
    await handler.sendMessage(channelId, "⛔ Only admins can kick users.", {
      ephemeral: true,
    });
    return;
  }

  const targetUserId = mentions?.[0]?.userId;
  if (!targetUserId) {
    await handler.sendMessage(channelId, "Usage: /kick @user [reason]");
    return;
  }

  const reason = args.slice(1).join(" ") || "No reason provided";

  try {
    // Kick is typically ban + immediate unban, or remove from all channels
    const channels = await handler.listChannels(spaceId);
    for (const ch of channels) {
      try {
        await handler.removeMemberFromChannel(spaceId, ch.id, targetUserId);
      } catch (err) {
        // User might not be in channel, continue
      }
    }

    addInfraction(spaceId, targetUserId, {
      type: "kick",
      message: reason,
      messageId: "",
      timestamp: Date.now(),
    });

    await handler.sendMessage(
      channelId,
      `👢 Kicked <@${targetUserId}>: ${reason}`
    );
    console.log(`[MOD] ${userId} kicked ${targetUserId}: ${reason}`);
  } catch (err) {
    console.error("Failed to kick user:", err);
    await handler.sendMessage(
      channelId,
      `❌ Failed to kick user.`,
      { ephemeral: true }
    );
  }
}
