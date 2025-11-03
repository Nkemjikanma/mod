import {
  makeTownsBot,
  BotHandler,
  BasePayload,
  MessageOpts,
} from "@towns-protocol/bot";
import { checkProfanity } from "./modules/profanity";
import { ensureTown, getTown } from "./db/index";
import { handleMuteLabel } from "./commands/muteLabel";
import { handleInfractions } from "./commands/infractions";
import commands from "./commands";
import { handleBotMention } from "./utils/botMentions";
import {
  InteractionRequest,
  InteractionResponse,
  InteractionResponseSchema,
  InteractionRequestSchema,
} from "@towns-protocol/proto";

export const bot = await makeTownsBot(
  process.env.PRIVATE_DATA!,
  process.env.JWT_SECRET!,
  { commands },
);

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

  await handler.sendInteractionRequest(channelId, {
    content: {
      case: "genericRequest",
      value: {
        id: userId,
        name: "welcomeInteraction",
        payload: {
          type: "welcome",
          userId,
          message: `
👋 Welcome to the town, <@${userId}>!

Please read the guidelines:

• Be respectful  
• No spamming  
• Follow the rules in #rules  

React with ${ACCESS_EMOJI} to gain full access to the town.
          `,
          emoji: ACCESS_EMOJI,
        },
      },
    },
  });

  console.log(`[mod-bot] Sent welcome interaction to ${userId}`);

  channelSettings.isAutojoin;

  bot.onReaction(async (handler, event) => {});
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
  } catch (error) {}
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

bot.onReaction(async (handler, { reaction, channelId }) => {
  if (reaction === "👋") {
    await handler.sendMessage(channelId, "I saw your wave! 👋");
  }
});
export const { jwtMiddleware, handler } = bot.start();
