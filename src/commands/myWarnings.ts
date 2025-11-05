import type { BotHandler } from "@towns-protocol/bot";
import { getMember } from "../db/index";

export async function handleMyWarnings(
  handler: BotHandler,
  {
    channelId,
    spaceId,
    userId,
  }: {
    channelId: string;
    spaceId: string;
    userId: string;
  }
) {
  try {
    const member = getMember(spaceId, userId);

    if (member.warnings === 0) {
      await handler.sendMessage(channelId, "✅ You have no warnings!", {
        ephemeral: true,
      });
      return;
    }

    const infractions = member.infractions.slice(0, 5); // Last 5
    const list = infractions
      .map(
        (i) =>
          `• **${i.type}** — ${new Date(i.timestamp).toLocaleString()}\n  _${i.message.substring(0, 50)}_`
      )
      .join("\n");

    await handler.sendMessage(
      channelId,
      `⚠️ **Your Warnings (${member.warnings} total)**\n\n${list}\n\n_React with ✅ to acknowledge_`,
      { ephemeral: true }
    );
  } catch (err) {
    console.error("Error fetching warnings:", err);
    await handler.sendMessage(
      channelId,
      "❌ Failed to fetch your warnings.",
      { ephemeral: true }
    );
  }
}
