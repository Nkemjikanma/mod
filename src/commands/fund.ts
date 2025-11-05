import type { BotHandler } from "@towns-protocol/bot";
import { isAdmin } from "../utils/permissions";
import { getSpaceBudget, formatBudgetInfo } from "../modules/budget";
import { formatEther, formatUnits } from "viem";

export async function handleFund(
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
  const budget = getSpaceBudget(spaceId);
  const isSpaceAdmin = await isAdmin(handler, spaceId, userId);

  let message = `💰 **Fund ModBot for This Space**\n\n`;

  // Show current budget status
  message += `📊 **Current Budget Status:**\n`;
  message += `Balance: ${formatUnits(budget.balance, 6)} USDC\n`;
  message += `Total Gas Spent: ${formatEther(budget.totalSpent)} ETH\n`;

  if (budget.setupCompleted) {
    message += `Setup: ✅ Complete\n\n`;
  } else {
    message += `Setup: ⚠️ Not complete - Run \`/setup\` first\n\n`;
  }

  if (isSpaceAdmin) {
    message += `---\n\n`;
    message += `**Option 1: Tip the Bot** ✨ _(Recommended)_\n\n`;
    message += `Simply tip the bot with **USDC** and it will **automatically** be added to this space's budget.\n\n`;
    message += `**How to tip:**\n`;
    message += `1. Click on any message from the bot\n`;
    message += `2. Select "Tip" from the menu\n`;
    message += `3. Enter the amount in USDC (e.g., 10 USDC)\n`;
    message += `4. Confirm the transaction\n\n`;
    message += `The USDC will be instantly credited to your space budget! 🎉\n\n`;

    message += `---\n\n`;
    message += `**Option 2: Manual Allocation** 🔧\n\n`;
    message += `If you've sent USDC to the bot wallet, you can manually allocate it:\n\n`;
    message += `\`/budget fund <amount>\`\n\n`;
    message += `This allocates USDC from the bot's balance to your space.\n\n`;



    message += `---\n\n`;
    message += `💡 **Why fund the bot?**\n\n`;
    message += `**Tips are in USDC**, which funds your space budget.\n`;
    message += `**Gas fees are in ETH**, paid by the bot wallet.\n\n`;
    message += `On-chain operation costs:\n`;
    message += `• Creating roles: ~0.00002 ETH (~$0.06)\n`;
    message += `• Assigning roles: ~0.00001 ETH (~$0.03) per user\n`;
    message += `• 100 users verified: ~$3 worth of ETH\n\n`;
    message += `Your USDC covers the equivalent cost in gas fees for **your space only**.\n\n`;

    message += `📖 **Need more help?**\n`;
    message += `• \`/budget status\` - View detailed budget info\n`;
    message += `• \`/budget estimate <operation>\` - Estimate operation costs\n`;
    message += `• \`/budget expenses\` - View spending history\n`;
  } else {
    // Non-admin view
    message += `\n⚠️ **Admin-Only Feature**\n\n`;
    message += `Only space administrators can fund the bot and manage the budget.\n\n`;
    message += `If you'd like to support the bot, you can:\n`;
    message += `• Ask an admin to add funds\n`;
    message += `• Tip the bot normally (admins can allocate tips to space budget)\n\n`;
    message += `💡 **What is funding for?**\n`;
    message += `Spaces are funded with **USDC tips**, which cover the cost of ETH gas fees for:\n`;
    message += `• Creating verification roles on-chain\n`;
    message += `• Assigning roles to verified members\n`;
    message += `• Other on-chain moderation features\n\n`;
    message += `All USDC funds are tracked per-space and used only for that space's operations.\n\n`;
    message += `_Note: Towns tips are in USDC by default. The bot uses ETH for gas, but your budget is in USDC._`;
  }

  await handler.sendMessage(channelId, message);
}
