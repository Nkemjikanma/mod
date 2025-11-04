import {
  makeTownsBot,
  BotHandler,
  BasePayload,
  MessageOpts,
} from "@towns-protocol/bot";
import { checkProfanity } from "./modules/profanity";
import {
  ensureTown,
  getTown,
  saveWelcomeMessage,
  getWelcomeMessage,
} from "./db/index";
import { handleMuteLabel } from "./commands/muteLabel";
import { handleInfractions } from "./commands/infractions";
import commands from "./commands";
import { handleBotMention } from "./utils/botMentions";

export const bot = await makeTownsBot(
  process.env.PRIVATE_DATA!,
  process.env.JWT_SECRET!,
  { commands },
);

export const { jwtMiddleware, handler } = bot.start();
console.log(
    process.env.PRIVATE_DATA!,
)
// handle "onInstall" situation
bot.onChannelJoin(async (handler, event) => {
  const { spaceId, userId, channelId } = event;

  if (userId === bot.botId) {
    console.log(
      `[mod-bot] Detected bot joined a new channel in space: ${spaceId}`,
    );
    ensureTown(spaceId);

    return;
  }

  ensureTown(spaceId);
  const town = getTown(spaceId);
  const channelSettings = await handler.getChannelSettings(spaceId);
  const ACCESS_EMOJI = "✅";

  const welcomeMessage = `
👋 **Welcome to the ${town.townId}>, <@${userId}>!**

Please take a moment to review our community guidelines:

> • Be respectful
> • No spamming
> • Follow all rules

React with ${ACCESS_EMOJI} below to gain access to the rest of the town channels.
`;

  const messageEvent = await handler.sendMessage(channelId, welcomeMessage);

  await handler.sendReaction(channelId, messageEvent.eventId, ACCESS_EMOJI);
  console.log(`[mod-bot] Sent welcome interaction to ${userId}`);

  saveWelcomeMessage(spaceId, channelId, messageEvent.eventId);
});

bot.onReaction(async (handler, event) => {
  const { reaction, messageId, spaceId, channelId, userId } = event;
  const ACCESS_EMOJI = "✅";

  // Handle welcome message verification
  const latestWelcomeId = getWelcomeMessage(spaceId, channelId);
  if (reaction === ACCESS_EMOJI && latestWelcomeId && messageId === latestWelcomeId) {
    console.log(`[mod-bot] ${userId} verified — granting access.`);

    // Grant access to other channels
    const channels = await handler.listChannels(spaceId);
    for (const ch of channels) {
      if (ch.id !== channelId && ch.type !== "private") {
        try {
          await handler.addMemberToChannel(spaceId, ch.id, userId);
        } catch (err) {
          console.error(`Failed to add ${userId} to ${ch.id}`, err);
        }
      }
    }

    await handler.sendMessage(
      channelId,
      `✅ <@${userId}> now has full access to the town! Welcome aboard! 🎉`,
    );
  }

  // Handle other reactions (e.g., waves)
  if (reaction === "👋") {
    await handler.sendMessage(channelId, "I saw your wave! 👋");
  }
});

// ✅ Safe lazy init on message too
bot.onMessage(async (handler, event) => {
  const { message, spaceId, userId, eventId, channelId, isMentioned } = event;

  // Skip bot's own messages
  if (userId === bot.botId) return;
  try {
    ensureTown(spaceId);

    const town = getTown(spaceId);

    if (town.settings.profanityFilter) {
      const member = await checkProfanity(spaceId, userId, message, eventId);
      if (member) {
        console.log(`[MOD] Profanity detected in ${spaceId} by ${userId}`);
        await handler.sendMessage(
          channelId,
          `⚠️ Please avoid profanity, <@${userId}>. Warning ${member.warnings}/3`,
          {
            ephemeral: true,
          },
        );

        if (
          town.settings.autoWarn &&
          member.warnings >= town.settings.warnAfter
        ) {
          await handler.sendMessage(
            channelId,
            `🚫 <@${userId}> has been warned multiple times for profanity.`,
          );
        }
      }
    }

    if (isMentioned) {
      await handleBotMention(
        handler,
        message,
        spaceId,
        userId,
        eventId,
        channelId,
      );
    }
  } catch (error) {
    console.log(`An error occured while handling onMessage ${error}`);
  }
});

// Slash commands
bot.onSlashCommand("mute-label", handleMuteLabel);
bot.onSlashCommand("infractions", handleInfractions);
bot.onSlashCommand(
  "settings",
  async (handler, { channelId, args, spaceId }) => {},
);
bot.onSlashCommand(
  "help",
  async (handler, { channelId, spaceId, userId, args, mentions }) => {
    await handleBotMention(
      handler,
      args.join(", "), // passing args as message
      spaceId,
      userId,
      channelId,
    );
  },
);
