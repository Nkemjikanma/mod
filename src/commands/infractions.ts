import type { BotHandler } from "@towns-protocol/bot";
import { getTown, getMember } from "../db/index";

export async function handleInfractions(
  handler: BotHandler,
  {
    channelId,
    mentions,
    spaceId,
  }: { channelId: string; mentions: any[]; spaceId: string },
) {
  const mentionedUserId = mentions?.[0]?.userId;
  if (!mentionedUserId) {
    await handler.sendMessage(channelId, "Usage: /mod infractions @user");
    return;
  }

  const town = getTown(spaceId);
  const member = getMember(spaceId, mentionedUserId);

  if (!member.infractions || member.infractions.length === 0) {
    await handler.sendMessage(
      channelId,
      `<@${mentionedUserId}> has no recorded infractions.`,
    );
    return;
  }

  const list = member.infractions
    .map(
      (i) =>
        `• ${i.type} — "${i.message}" (${new Date(i.timestamp).toLocaleString()})`,
    )
    .join("\n");

  await handler.sendMessage(
    channelId,
    `Infractions for <@${mentionedUserId}>:\n${list}`,
  );
}
