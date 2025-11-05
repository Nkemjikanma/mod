import {
  makeTownsBot,
  BotHandler,
  BasePayload,
  MessageOpts,
} from "@towns-protocol/bot";
import { formatEther, formatUnits } from "viem";
import { checkProfanity } from "./modules/profanity";
// import { detectSpam, handleSpamDetection } from "./modules/spam";
import {
  ensureTown,
  getTown,
  saveWelcomeMessage,
  getWelcomeMessage,
  getMember,
  addLabel,
} from "./db/index";
import { depositToSpace, getSpaceBudget, needsRefund } from "./modules/budget";
// import { assignRoleToUserWithBudget } from "./web3/spaceRoles";
import { handleMuteLabel } from "./commands/muteLabel";
import { handleInfractions } from "./commands/infractions";
import { handleSettings } from "./commands/settings";
import { handleBan } from "./commands/ban";
import { handleUnban } from "./commands/unban";
import { handleWarn } from "./commands/warn";
import { handleKick } from "./commands/kick";
import { handleMyWarnings } from "./commands/myWarnings";
import { handleSetup } from "./commands/setup";
import { handleBudget } from "./commands/budget";
import { handleFund } from "./commands/fund";
import commands from "./commands";
import { handleBotMention } from "./utils/botMentions";
import { db } from "./db/index";

export const bot = await makeTownsBot(
  process.env.PRIVATE_DATA!,
  process.env.JWT_SECRET!,
  { commands },
);

export const { jwtMiddleware, handler } = bot.start();
console.log("[MOD] Bot initialized. Address:", bot.viem.account.address);

// =====================================================
// CHANNEL JOIN HANDLER - Welcome new users
// =====================================================
bot.onChannelJoin(async (handler, event) => {
  const { spaceId, userId, channelId } = event;

  // If the bot itself joined
  if (userId === bot.botId) {
    console.log(
      `[mod-bot] Bot joined channel ${channelId} in space: ${spaceId}`,
    );
    ensureTown(spaceId);

    // Installation message
    try {
      await handler.sendMessage(
        channelId,
        `👋 **ModBot has been installed!**\n\n` +
          `I'm here to help moderate this community. I can:\n\n` +
          `• 🔍 Detect and remove profanity & spam\n` +
          `• ⚠️ Track warnings and infractions\n` +
          `• ✅ Verify new members with on-chain roles\n` +
          `• 📊 Provide detailed moderation analytics\n\n` +
          `**Admin Setup:**\n` +
          `1. Fund the bot: \`/fund\`\n` +
          `2. Run setup: \`/setup\`\n` +
          `3. Configure: \`/settings\`\n\n` +
          `Type \`/help\` or mention me for more info!`,
      );
    } catch (err) {
      console.error("[mod-bot] Failed to send installation message:", err);
    }
    return;
  }

  // A user joined a channel - send welcome message
  ensureTown(spaceId);
  const town = getTown(spaceId);

  // Check if user is already verified
  const member = getMember(spaceId, userId);
  if (member.labels.includes("verified")) {
    // User already verified, just send a quick welcome
    try {
      await handler.sendMessage(
        channelId,
        `👋 Welcome back, <@${userId}>! Good to see you again.`,
      );
    } catch (err) {
      console.error("[mod-bot] Failed to send welcome back message:", err);
    }
    return;
  }

  // New unverified user - send verification message
  const ACCESS_EMOJI = "✅";
  const budget = getSpaceBudget(spaceId);

  const welcomeMessage = `👋 **Welcome to the community, <@${userId}>!**

Please take a moment to review our community guidelines:

> **📜 Community Rules:**
> • Be respectful to all members
> • No spamming or excessive posting
> • No profanity or offensive content
> • Follow all channel-specific rules
> • Have fun and contribute positively!

**To get verified${budget.setupCompleted ? " and receive your on-chain role" : ""}**, please react with ${ACCESS_EMOJI} below to acknowledge that you've read and agree to follow these rules.

${
  budget.setupCompleted
    ? `✨ **Verified members receive:**
• On-chain "Verified Member" role
• Recognition and full access in the community
• Reduced moderation restrictions

`
    : `_Note: On-chain verification is not yet set up. Admins can enable it with \`/setup\`._

`
}_By reacting, you confirm you've read our guidelines._`;

  try {
    const messageEvent = await handler.sendMessage(channelId, welcomeMessage);
    await handler.sendReaction(channelId, messageEvent.eventId, ACCESS_EMOJI);
    console.log(`[mod-bot] Sent welcome message to ${userId} in ${channelId}`);
    saveWelcomeMessage(spaceId, channelId, messageEvent.eventId);
  } catch (err) {
    console.error("[mod-bot] Failed to send welcome message:", err);
  }
});

// =====================================================
// REACTION HANDLER - Verification and interactions
// =====================================================
bot.onReaction(async (handler, event) => {
  const { reaction, messageId, spaceId, channelId, userId } = event;
  const ACCESS_EMOJI = "✅";

  // Skip bot's own reactions
  if (userId === bot.botId) return;

  // Handle welcome message verification (rule acknowledgment)
  const latestWelcomeId = getWelcomeMessage(spaceId, channelId);
  if (
    reaction === ACCESS_EMOJI &&
    latestWelcomeId &&
    messageId === latestWelcomeId
  ) {
    console.log(`[mod-bot] ${userId} acknowledged rules in ${spaceId}`);

    try {
      ensureTown(spaceId);
      const member = getMember(spaceId, userId);

      if (member.labels.includes("verified")) {
        await handler.sendMessage(
          channelId,
          `👋 You're already verified, <@${userId}>!`,
          { ephemeral: true },
        );
        return;
      }

      // Check if on-chain role system is set up
      const townRow = db
        .query(
          "SELECT verified_role_id, user_entitlement_module, setup_completed FROM towns WHERE town_id = ?",
        )
        .get(spaceId) as any;

      if (
        townRow?.setup_completed &&
        townRow.verified_role_id &&
        townRow.user_entitlement_module
      ) {
        // On-chain setup is complete - assign role via blockchain
        await handler.sendMessage(
          channelId,
          `⏳ Verifying <@${userId}> on-chain... This may take a moment.`,
        );

        try {
          const { hash, cost } = await assignRoleToUserWithBudget(
            bot,
            spaceId,
            userId, // User's wallet address
            BigInt(townRow.verified_role_id),
            townRow.user_entitlement_module,
            userId,
          );

          // Also add database label
          addLabel(spaceId, userId, "verified");

          await handler.sendMessage(
            channelId,
            `✅ **<@${userId}> is now a Verified Member!** 🎉\n\n` +
              `You've been assigned the "Verified Member" role on-chain.\n` +
              `🔗 Transaction: \`${hash.substring(0, 16)}...\`\n` +
              `💰 Cost: ${formatEther(cost)} ETH\n\n` +
              `Welcome to the community! You now have full access to all features.`,
          );

          console.log(
            `[Verification] Assigned role ${townRow.verified_role_id} to ${userId}. TX: ${hash}`,
          );

          // Check if space needs refunding
          if (needsRefund(spaceId)) {
            const budget = getSpaceBudget(spaceId);
            await handler.sendMessage(
              channelId,
              `⚠️ **Admin Alert:** Space budget is running low!\n\n` +
                `Current balance: ${formatEther(budget.balance)} ETH\n\n` +
                `Please add more funds using \`/fund\` to continue on-chain operations or send a Tip`,
              { ephemeral: true },
            );
          }
        } catch (err) {
          console.error("[Verification] Failed to assign on-chain role:", err);

          // Fall back to database-only verification
          addLabel(spaceId, userId, "verified");

          const errorMessage = err instanceof Error ? err.message : String(err);

          if (errorMessage.includes("Insufficient budget")) {
            await handler.sendMessage(
              channelId,
              `⚠️ **Verification completed (database only)**\n\n` +
                `Welcome, <@${userId}>! 👋\n\n` +
                `_On-chain role assignment failed due to insufficient budget. ` +
                `Admins: Please add funds using \`/fund\` to enable blockchain verification._`,
              { ephemeral: true },
            );
          } else {
            await handler.sendMessage(
              channelId,
              `⚠️ **Verification completed (database only)**\n\n` +
                `Welcome anyway, <@${userId}>! 👋\n\n` +
                `_On-chain role assignment failed: ${errorMessage}_`,
              { ephemeral: true },
            );
          }
        }
      } else {
        // No on-chain setup, fall back to database-only
        addLabel(spaceId, userId, "verified");

        await handler.sendMessage(
          channelId,
          `✅ **Thank you for verifying, <@${userId}>!** Welcome! 🎉\n\n` +
            `You're now a verified member of the community!\n\n` +
            `_Note: On-chain roles not set up. Admins can enable blockchain-based verification with \`/setup\`._`,
        );
      }
    } catch (err) {
      console.error("[mod-bot] Failed to process verification:", err);
      await handler.sendMessage(
        channelId,
        `❌ Failed to process verification. Please try again or contact an admin.`,
        { ephemeral: true },
      );
    }
    return;
  }

  // Handle other reactions (e.g., waves)
  if (reaction === "👋") {
    await handler.sendMessage(channelId, "I saw your wave! 👋");
  }
});

// =====================================================
// TIP HANDLER - Funding mechanism
// =====================================================
bot.onTip(async (handler, event) => {
  const {
    spaceId,
    channelId,
    userId,
    messageId,
    senderAddress,
    receiverAddress,
    amount,
    currency,
  } = event;

  // Check if tip was sent to the bot
  if (
    receiverAddress.toLowerCase() !== bot.viem.account.address.toLowerCase()
  ) {
    return; // Not for us
  }

  // USDC has 6 decimals, format accordingly
  const formattedAmount = formatUnits(amount, 6);

  console.log(
    `[Funding] Received ${formattedAmount} USDC tip from ${userId} in space ${spaceId}`,
  );

  try {
    // Only accept USDC tips (Base USDC address)
    const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    if (currency.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
      await handler.sendMessage(
        channelId,
        `⚠️ <@${userId}>, I can only accept USDC tips for funding. Please tip with USDC.\n\n` +
          `_Tips in Towns are in USDC by default._`,
        { ephemeral: true },
      );
      return;
    }

    // Check if tipper is admin
    const isSpaceAdmin = await handler.hasAdminPermission(spaceId, userId);

    if (!isSpaceAdmin) {
      // Non-admin tip - just say thanks
      await handler.sendMessage(
        channelId,
        `🙏 Thank you for the tip, <@${userId}>! Your support is greatly appreciated! ❤️`,
      );
      return;
    }

    // Admin tip - add to space budget
    ensureTown(spaceId);
    depositToSpace(
      spaceId,
      amount,
      senderAddress,
      null,
      "tip_funding",
      `Tip from ${userId}`,
    );

    const budget = getSpaceBudget(spaceId);

    await handler.sendMessage(
      channelId,
      `✅ **Space Budget Funded!**\n\n` +
        `<@${userId}> added **${formattedAmount} USDC** to the space budget via tip.\n\n` +
        `💰 **New Balance:** ${formatUnits(budget.balance, 6)} USDC\n` +
        `📊 **Total Spent (ETH):** ${formatEther(budget.totalSpent)} ETH\n\n` +
        `_Note: Budget is tracked in USDC, but gas fees are paid in ETH._\n\n` +
        `Thank you for supporting this community! 🎉\n\n` +
        `_Use \`/budget status\` to view detailed budget information._`,
    );

    console.log(
      `[Funding] Added ${formattedAmount} USDC to space ${spaceId} budget via tip`,
    );
  } catch (err) {
    console.error("[Funding] Error processing tip:", err);
    await handler.sendMessage(
      channelId,
      `❌ Failed to process funding: ${err instanceof Error ? err.message : String(err)}`,
      { ephemeral: true },
    );
  }
});

// =====================================================
// MESSAGE HANDLER - Profanity, spam, mentions
// =====================================================
bot.onMessage(async (handler, event) => {
  const { message, spaceId, userId, eventId, channelId, isMentioned } = event;

  // Skip bot's own messages
  if (userId === bot.botId) return;

  try {
    ensureTown(spaceId);
    const town = getTown(spaceId);

    // Check for spam first
    // if (town.settings.spamDetection) {
    //   const spamCheck = detectSpam(userId, message, channelId);
    //   if (spamCheck.isSpam) {
    //     console.log(`[MOD] Spam detected from ${userId}: ${spamCheck.reason}`);
    //
    //     // Delete the spam message
    //     try {
    //       await handler.adminRemoveEvent(spaceId, eventId);
    //     } catch (err) {
    //       console.error("[MOD] Failed to delete spam message:", err);
    //     }
    //
    //     const member = handleSpamDetection(spaceId, userId, message, eventId);
    //
    //     await handler.sendMessage(
    //       channelId,
    //       `🚫 <@${userId}>, please don't spam. Warning ${member.warnings}/${town.settings.warnAfter}`,
    //       { ephemeral: true },
    //     );
    //
    //     // Auto-ban if too many warnings
    //     if (member.warnings >= town.settings.warnAfter) {
    //       try {
    //         await handler.ban(userId, spaceId);
    //         await handler.sendMessage(
    //           channelId,
    //           `🔨 <@${userId}> has been automatically banned for repeated spam violations.`,
    //         );
    //       } catch (err) {
    //         console.error("[MOD] Failed to auto-ban user:", err);
    //       }
    //     }
    //     return; // Stop processing this message
    //   }
    // }

    // Check for profanity
    if (town.settings.profanityFilter) {
      const member = await checkProfanity(
        handler,
        spaceId,
        userId,
        message,
        eventId,
        channelId,
        spaceId,
      );

      if (member) {
        console.log(`[MOD] Profanity detected in ${spaceId} by ${userId}`);

        await handler.sendMessage(
          channelId,
          `⚠️ Please avoid profanity, <@${userId}>. Warning ${member.warnings}/${town.settings.warnAfter}`,
          { ephemeral: true },
        );

        // Auto-notify on threshold
        if (
          town.settings.autoWarn &&
          member.warnings >= town.settings.warnAfter
        ) {
          await handler.sendMessage(
            channelId,
            `🚫 <@${userId}> has been flagged for review (${member.warnings} warnings). Moderators have been notified.`,
          );
        }
        return; // Stop processing this message
      }
    }

    // Handle bot mentions
    if (isMentioned) {
      await handleBotMention(
        handler,
        message,
        spaceId,
        userId,
        channelId,
        eventId,
      );
    }
  } catch (error) {
    console.error(`[MOD] Error in onMessage handler:`, error);
  }
});

// =====================================================
// SLASH COMMAND REGISTRATIONS
// =====================================================

// Admin commands
bot.onSlashCommand("setup", async (handler, context) => {
  await handleSetup(handler, bot, context);
});

bot.onSlashCommand("ban", handleBan);
bot.onSlashCommand("unban", handleUnban);
bot.onSlashCommand("kick", handleKick);
bot.onSlashCommand("warn", handleWarn);
bot.onSlashCommand("mute-label", handleMuteLabel);
bot.onSlashCommand("infractions", handleInfractions);

// Settings commands
bot.onSlashCommand("settings", handleSettings);
bot.onSlashCommand("budget", async (handler, context) => {
  await handleBudget(handler, bot, context);
});

// Funding command
bot.onSlashCommand("fund", async (handler, context) => {
  await handleFund(handler, bot, context);
});

// User commands
bot.onSlashCommand("mywarnings", handleMyWarnings);

// Help command
bot.onSlashCommand("help", async (handler, { channelId, spaceId, userId }) => {
  await handleBotMention(handler, "help", spaceId, userId, channelId);
});

console.log("[MOD] Bot handlers registered successfully!");
console.log(`[MOD] Bot wallet address: ${bot.viem.account.address}`);
console.log("[MOD] Ready to receive commands and tips!");
