import type { BotHandler } from "@towns-protocol/bot";
import { isAdmin } from "../utils/permissions";
import {
  createSpaceRoleWithBudget,
  TownsPermission,
  getUserEntitlementModule,
} from "../web3/spaceRoles";
import { getSpaceBudget, markSetupCompleted, formatBudgetInfo, estimateOperationCost } from "../modules/budget";
import { formatEther } from "viem";

export async function handleSetup(
  handler: BotHandler,
  bot: any,
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
  // Only admins can run setup
  if (!(await isAdmin(handler, spaceId, userId))) {
    await handler.sendMessage(channelId, "⛔ Only space admins can run setup.", {
      ephemeral: true,
    });
    return;
  }

  const budget = getSpaceBudget(spaceId);

  // Check if already set up
  if (budget.setupCompleted) {
    await handler.sendMessage(
      channelId,
      `⚠️ **ModBot is already set up for this space!**\n\n` +
        `Verified role is active and ready to use.\n\n` +
        `📊 ${formatBudgetInfo(budget)}`
    );
    return;
  }

  // Estimate cost
  const estimatedCost = estimateOperationCost("create_role");

  await handler.sendMessage(
    channelId,
    `🔧 **Setting up ModBot with on-chain roles...**\n\n` +
      `This will:\n` +
      `• Create a "Verified Member" role on-chain\n` +
      `• Enable automatic role assignment on verification\n` +
      `• Consume approximately ${formatEther(estimatedCost)} ETH in gas fees\n\n` +
      `⏳ Please wait, this may take a moment...`
  );

  try {
    // Check if we have sufficient budget
    if (budget.balance < estimatedCost) {
      await handler.sendMessage(
        channelId,
        `❌ **Setup failed: Insufficient budget**\n\n` +
          `**Required:** ~${formatEther(estimatedCost)} ETH\n` +
          `**Available:** ${formatEther(budget.balance)} ETH\n\n` +
          `**How to fund your space:**\n\n` +
          `1️⃣ **Tip the bot** (Recommended):\n` +
          `   \`/tip @ModBot <amount>\`\n\n` +
          `2️⃣ **View funding options:**\n` +
          `   \`/fund\`\n\n` +
          `3️⃣ **Admin allocation:**\n` +
          `   \`/budget fund <amount>\``
      );
      return;
    }

    console.log(`[Setup] Starting setup for space ${spaceId}`);

    // Step 1: Get the UserEntitlement module address
    await handler.sendMessage(channelId, `⏳ Step 1/3: Finding UserEntitlement module...`);

    const userEntitlementModule = await getUserEntitlementModule(bot, spaceId);
    console.log(`[Setup] UserEntitlement module: ${userEntitlementModule}`);

    // Step 2: Create the "Verified Member" role on-chain
    await handler.sendMessage(channelId, `⏳ Step 2/3: Creating "Verified Member" role on-chain...`);

    const { hash, roleId, cost } = await createSpaceRoleWithBudget(
      bot,
      spaceId,
      "Verified Member",
      [
        TownsPermission.Read,
        TownsPermission.Write,
        TownsPermission.React,
        TownsPermission.PinMessage,
      ],
      userId
    );

    console.log(`[Setup] Role created. TX: ${hash}, Role ID: ${roleId}, Cost: ${formatEther(cost)} ETH`);

    // Step 3: Mark setup as complete in database
    await handler.sendMessage(channelId, `⏳ Step 3/3: Finalizing setup...`);

    markSetupCompleted(spaceId, roleId, userEntitlementModule);

    // Get updated budget
    const updatedBudget = getSpaceBudget(spaceId);

    // Send success message
    await handler.sendMessage(
      channelId,
      `✅ **ModBot Setup Complete!** 🎉\n\n` +
        `**On-Chain Role Created:**\n` +
        `🏷️ Name: **Verified Member**\n` +
        `🆔 Role ID: \`${roleId}\`\n` +
        `📝 Transaction: \`${hash}\`\n` +
        `💰 Cost: ${formatEther(cost)} ETH\n\n` +
        `**Permissions Granted:**\n` +
        `• Read messages\n` +
        `• Write messages\n` +
        `• React to messages\n` +
        `• Pin messages\n\n` +
        `**What's Next?**\n` +
        `When new users join and react with ✅ to the welcome message, ` +
        `they will automatically be assigned this role on-chain!\n\n` +
        `📊 **Budget Status:**\n` +
        `Balance: ${formatEther(updatedBudget.balance)} ETH\n` +
        `Total Spent: ${formatEther(updatedBudget.totalSpent)} ETH\n\n` +
        `_Use \`/budget status\` to view detailed budget information._`
    );

    console.log(`[Setup] Setup completed successfully for space ${spaceId}`);
  } catch (err) {
    console.error("[Setup] Failed to complete setup:", err);

    const errorMessage = err instanceof Error ? err.message : String(err);

    await handler.sendMessage(
      channelId,
      `❌ **Setup Failed**\n\n` +
        `An error occurred during setup:\n` +
        `\`\`\`\n${errorMessage}\n\`\`\`\n\n` +
        `**Common issues:**\n` +
        `• Insufficient budget - Use \`/fund\` to add more funds\n` +
        `• Bot lacks ModifyRoles permission - Space owner must grant this\n` +
        `• Network issues - Please try again\n\n` +
        `If the problem persists, please contact support.`
    );
  }
}
