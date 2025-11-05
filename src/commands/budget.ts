import type { BotHandler } from "@towns-protocol/bot";
import { isAdmin } from "../utils/permissions";
import {
  getSpaceBudget,
  depositToSpace,
  getSpaceExpenses,
  getSpaceDeposits,
  formatBudgetInfo,
  setSpaceBudgetLimit,
  setAutoRefundThreshold,
  getExpensesByType,
  estimateOperationCost,
  getBotUsdcBalance,
  getTotalAllocatedUsdc,
  getUnallocatedUsdc,
  canAllocateUsdc,
} from "../modules/budget";
import { formatEther, parseEther, formatUnits, parseUnits } from "viem";

export async function handleBudget(
  handler: BotHandler,
  bot: any,
  {
    channelId,
    spaceId,
    userId,
    args,
  }: {
    channelId: string;
    spaceId: string;
    userId: string;
    args: string[];
  }
) {
  // Only admins can manage budget
  if (!(await isAdmin(handler, spaceId, userId))) {
    await handler.sendMessage(
      channelId,
      "⛔ Only space admins can manage budget.",
      { ephemeral: true }
    );
    return;
  }

  const subcommand = args[0]?.toLowerCase();

  try {
    switch (subcommand) {
      case "status":
      case undefined:
        await handleBudgetStatus(handler, channelId, spaceId);
        break;

      case "fund":
      case "deposit":
        await handleBudgetFund(handler, bot, channelId, spaceId, userId, args.slice(1));
        break;

      case "balance":
      case "check":
        await handleCheckBotBalance(handler, bot, channelId);
        break;

      case "expenses":
      case "history":
        await handleBudgetExpenses(handler, channelId, spaceId, args.slice(1));
        break;

      case "deposits":
        await handleBudgetDeposits(handler, channelId, spaceId);
        break;

      case "limit":
        await handleBudgetLimit(handler, channelId, spaceId, args.slice(1));
        break;

      case "threshold":
        await handleAutoRefundThreshold(handler, channelId, spaceId, args.slice(1));
        break;

      case "estimate":
        await handleCostEstimate(handler, channelId, args.slice(1));
        break;

      case "breakdown":
        await handleExpenseBreakdown(handler, channelId, spaceId);
        break;

      default:
        await handler.sendMessage(
          channelId,
          `❌ Unknown budget subcommand: \`${subcommand}\`\n\n` +
            `**Available commands:**\n` +
            `• \`/budget status\` - View current budget\n` +
            `• \`/budget fund <amount>\` - Add funds (in USDC)\n` +
            `• \`/budget balance\` - Check bot's actual USDC balance\n` +
            `• \`/budget expenses [limit]\` - View expense history\n` +
            `• \`/budget deposits\` - View deposit history\n` +
            `• \`/budget limit <amount|none>\` - Set spending limit\n` +
            `• \`/budget threshold <amount|none>\` - Set low balance alert\n` +
            `• \`/budget estimate <operation>\` - Estimate operation cost\n` +
            `• \`/budget breakdown\` - View expenses by type`
        );
    }
  } catch (err) {
    console.error("[Budget] Command error:", err);
    await handler.sendMessage(
      channelId,
      `❌ Budget command failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function handleBudgetFund(
  handler: BotHandler,
  bot: any,
  channelId: string,
  spaceId: string,
  userId: string,
  args: string[]
) {
  const amountStr = args[0];

  if (!amountStr) {
    await handler.sendMessage(
      channelId,
      `**Usage:** \`/budget fund <amount>\`\n\n` +
        `**Example:** \`/budget fund 10\` (adds 10 USDC)\n\n` +
        `This manually allocates USDC from the bot's wallet to this space's budget.\n\n` +
        `⚠️ **Important:** This verifies bot actually has the USDC before allocating!\n\n` +
        `Use \`/budget balance\` to check available USDC first.`
    );
    return;
  }

  try {
    const amountUsdc = parseUnits(amountStr, 6); // USDC has 6 decimals

    if (amountUsdc <= 0n) {
      await handler.sendMessage(channelId, "❌ Amount must be positive");
      return;
    }

    // Verify bot actually has enough unallocated USDC
    await handler.sendMessage(channelId, "⏳ Verifying bot balance...");

    const { canAllocate, reason, available } = await canAllocateUsdc(bot, amountUsdc);

    if (!canAllocate) {
      await handler.sendMessage(
        channelId,
        `❌ **Cannot allocate funds**\n\n` +
          `${reason}\n\n` +
          `**Available to allocate:** ${formatUnits(available, 6)} USDC\n\n` +
          `**How to add more:**\n` +
          `1. Send USDC to bot wallet: \`${bot.viem.account.address}\`\n` +
          `2. Or use \`/tip @ModBot <amount>\` (automatic)\n\n` +
          `Use \`/budget balance\` to check bot's on-chain balance.`
      );
      return;
    }

    // Allocation verified - proceed
    depositToSpace(
      spaceId,
      amountUsdc,
      null,
      null,
      "admin_allocation",
      `Manual allocation by ${userId}`
    );

    const budget = getSpaceBudget(spaceId);

    await handler.sendMessage(
      channelId,
      `✅ **Added ${formatUnits(amountUsdc, 6)} USDC to space budget!**\n\n` +
        `**New Space Balance:** ${formatUnits(budget.balance, 6)} USDC\n` +
        `**Total Gas Spent:** ${formatEther(budget.totalSpent)} ETH\n\n` +
        `**Remaining Unallocated:** ${formatUnits(available - amountUsdc, 6)} USDC\n\n` +
        `_✅ Verified: Bot has sufficient USDC on-chain_`
    );
  } catch (err) {
    console.error("[Budget] Fund allocation error:", err);
    await handler.sendMessage(
      channelId,
      `❌ Failed to allocate funds: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function handleBudgetStatus(
  handler: BotHandler,
  channelId: string,
  spaceId: string
) {
  const budget = getSpaceBudget(spaceId);
  const info = formatBudgetInfo(budget);

  await handler.sendMessage(channelId, info);
}

async function handleBudgetExpenses(
  handler: BotHandler,
  channelId: string,
  spaceId: string,
  args: string[]
) {
  const limit = args[0] ? parseInt(args[0]) : 10;

  if (isNaN(limit) || limit < 1 || limit > 50) {
    await handler.sendMessage(channelId, "❌ Limit must be between 1 and 50");
    return;
  }

  const expenses = getSpaceExpenses(spaceId, limit);

  if (expenses.length === 0) {
    await handler.sendMessage(channelId, "📝 No expenses recorded yet.");
    return;
  }

  let message = `📝 **Recent Expenses (${expenses.length})**\n\n`;

  for (const expense of expenses) {
    const date = new Date(expense.timestamp).toLocaleDateString();
    const statusIcon =
      expense.status === "completed"
        ? "✅"
        : expense.status === "failed"
          ? "❌"
          : "⏳";

    message += `${statusIcon} **${expense.operation}**\n`;
    message += `  Cost: ${formatEther(expense.estimatedCost)} ETH\n`;
    message += `  Date: ${date}\n`;
    if (expense.details) message += `  Details: ${expense.details}\n`;
    message += `\n`;
  }

  const budget = getSpaceBudget(spaceId);
  message += `---\n\n`;
  message += `**Total Spent:** ${formatEther(budget.totalSpent)} ETH\n`;
  message += `**Current Balance:** ${formatUnits(budget.balance, 6)} USDC`;

  await handler.sendMessage(channelId, message);
}

async function handleBudgetDeposits(
  handler: BotHandler,
  channelId: string,
  spaceId: string
) {
  const deposits = getSpaceDeposits(spaceId);

  if (deposits.length === 0) {
    await handler.sendMessage(channelId, "💰 No deposits recorded yet.");
    return;
  }

  let message = `💰 **Deposit History (${deposits.length})**\n\n`;

  for (const deposit of deposits) {
    const date = new Date(deposit.timestamp).toLocaleDateString();
    const amount =
      deposit.source === "tip"
        ? formatUnits(deposit.amount, 6) + " USDC"
        : formatUnits(deposit.amount, 6) + " USDC";

    message += `✅ **${deposit.source}**\n`;
    message += `  Amount: ${amount}\n`;
    message += `  Date: ${date}\n`;
    if (deposit.details) message += `  Details: ${deposit.details}\n`;
    message += `\n`;
  }

  const budget = getSpaceBudget(spaceId);
  message += `---\n\n`;
  message += `**Current Balance:** ${formatUnits(budget.balance, 6)} USDC`;

  await handler.sendMessage(channelId, message);
}

async function handleCheckBotBalance(
  handler: BotHandler,
  bot: any,
  channelId: string
) {
  try {
    await handler.sendMessage(channelId, "⏳ Checking bot's on-chain USDC balance...");

    const actualBalance = await getBotUsdcBalance(bot);
    const totalAllocated = getTotalAllocatedUsdc();
    const unallocated = actualBalance - totalAllocated;

    let message = `💰 **Bot USDC Balance Report**\n\n`;
    message += `**On-Chain Balance:** ${formatUnits(actualBalance, 6)} USDC\n`;
    message += `**Total Allocated:** ${formatUnits(totalAllocated, 6)} USDC\n`;
    message += `**Available to Allocate:** ${formatUnits(unallocated, 6)} USDC\n\n`;

    if (unallocated < 0n) {
      message += `⚠️ **WARNING:** More USDC allocated than available!\n`;
      message += `This shouldn't happen. Please contact bot operator.\n\n`;
    } else if (unallocated < parseUnits("5", 6)) {
      message += `⚠️ **Low unallocated balance**\n`;
      message += `Consider adding more USDC to bot wallet or use tips.\n\n`;
    } else {
      message += `✅ Bot has sufficient unallocated USDC\n\n`;
    }

    message += `**Bot Wallet Address:**\n`;
    message += `\`${bot.viem.account.address}\`\n\n`;
    message += `**To add funds:**\n`;
    message += `• Send USDC (Base) to the address above\n`;
    message += `• Or use \`/tip @ModBot <amount>\` (automatic)\n\n`;
    message += `_Check on BaseScan: https://basescan.org/address/${bot.viem.account.address}_`;

    await handler.sendMessage(channelId, message);
  } catch (err) {
    console.error("[Budget] Failed to check bot balance:", err);
    await handler.sendMessage(
      channelId,
      `❌ Failed to check bot balance: ${err instanceof Error ? err.message : String(err)}\n\n` +
        `This may be a network issue. Please try again.`
    );
  }
}

async function handleBudgetLimit(
  handler: BotHandler,
  channelId: string,
  spaceId: string,
  args: string[]
) {
  const amountStr = args[0];

  if (!amountStr) {
    const budget = getSpaceBudget(spaceId);
    await handler.sendMessage(
      channelId,
      `**Current Budget Limit:** ${budget.budgetLimit ? formatEther(budget.budgetLimit) + " ETH" : "Unlimited"}\n\n` +
        `**Usage:**\n` +
        `• \`/budget limit <amount>\` - Set spending limit\n` +
        `• \`/budget limit none\` - Remove limit\n\n` +
        `**Example:** \`/budget limit 0.5\` (limit spending to 0.5 ETH)`
    );
    return;
  }

  if (amountStr.toLowerCase() === "none" || amountStr.toLowerCase() === "unlimited") {
    setSpaceBudgetLimit(spaceId, null);
    await handler.sendMessage(
      channelId,
      "✅ Budget limit removed. Spending is now unlimited."
    );
    return;
  }

  try {
    const limitWei = parseEther(amountStr);

    if (limitWei <= 0) {
      await handler.sendMessage(channelId, "❌ Limit must be positive");
      return;
    }

    setSpaceBudgetLimit(spaceId, limitWei);

    await handler.sendMessage(
      channelId,
      `✅ **Budget limit set to ${formatEther(limitWei)} ETH**\n\n` +
        `Operations will be blocked if total spending would exceed this amount.`
    );
  } catch (err) {
    await handler.sendMessage(
      channelId,
      `❌ Invalid amount: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function handleAutoRefundThreshold(
  handler: BotHandler,
  channelId: string,
  spaceId: string,
  args: string[]
) {
  const amountStr = args[0];

  if (!amountStr) {
    const budget = getSpaceBudget(spaceId);
    await handler.sendMessage(
      channelId,
      `**Current Auto-Refund Threshold:** ${budget.autoRefundThreshold ? formatEther(budget.autoRefundThreshold) + " ETH" : "Disabled"}\n\n` +
        `**Usage:**\n` +
        `• \`/budget threshold <amount>\` - Set low balance alert\n` +
        `• \`/budget threshold none\` - Disable alerts\n\n` +
        `When balance drops below this threshold, you'll be notified to add more funds.`
    );
    return;
  }

  if (amountStr.toLowerCase() === "none" || amountStr.toLowerCase() === "disable") {
    setAutoRefundThreshold(spaceId, null);
    await handler.sendMessage(
      channelId,
      "✅ Auto-refund threshold disabled. You won't receive low balance alerts."
    );
    return;
  }

  try {
    const thresholdWei = parseEther(amountStr);

    if (thresholdWei <= 0) {
      await handler.sendMessage(channelId, "❌ Threshold must be positive");
      return;
    }

    setAutoRefundThreshold(spaceId, thresholdWei);

    await handler.sendMessage(
      channelId,
      `✅ **Auto-refund threshold set to ${formatEther(thresholdWei)} ETH**\n\n` +
        `You'll be notified when the balance drops below this amount.`
    );
  } catch (err) {
    await handler.sendMessage(
      channelId,
      `❌ Invalid amount: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function handleCostEstimate(
  handler: BotHandler,
  channelId: string,
  args: string[]
) {
  const operation = args[0]?.toLowerCase();

  const validOperations = ["create_role", "assign_role", "remove_role"];

  if (!operation || !validOperations.includes(operation)) {
    await handler.sendMessage(
      channelId,
      `**Cost Estimation**\n\n` +
        `**Usage:** \`/budget estimate <operation>\`\n\n` +
        `**Valid operations:**\n` +
        `• \`create_role\` - Creating a new role\n` +
        `• \`assign_role\` - Assigning role to a user\n` +
        `• \`remove_role\` - Removing role from a user\n\n` +
        `**Example:** \`/budget estimate create_role\``
    );
    return;
  }

  const estimatedCost = estimateOperationCost(operation);

  const descriptions: Record<string, string> = {
    create_role: "Creating a new role on-chain",
    assign_role: "Assigning a role to one user",
    remove_role: "Removing a role from one user",
  };

  await handler.sendMessage(
    channelId,
    `💰 **Cost Estimate**\n\n` +
      `**Operation:** ${descriptions[operation]}\n` +
      `**Estimated Cost:** ~${formatEther(estimatedCost)} ETH\n\n` +
      `_Note: This is an estimate. Actual costs may vary based on network conditions._`
  );
}

async function handleExpenseBreakdown(
  handler: BotHandler,
  channelId: string,
  spaceId: string
) {
  const expensesByType = getExpensesByType(spaceId);
  const budget = getSpaceBudget(spaceId);

  if (Object.keys(expensesByType).length === 0) {
    await handler.sendMessage(channelId, "📊 No expenses recorded yet.");
    return;
  }

  let message = `📊 **Expense Breakdown**\n\n`;

  let totalOperations = 0;
  for (const [type, data] of Object.entries(expensesByType)) {
    totalOperations += data.count;
    const avgCost = data.total / BigInt(data.count);

    message += `**${type}**\n`;
    message += `  Count: ${data.count} operations\n`;
    message += `  Total: ${formatEther(data.total)} ETH\n`;
    message += `  Avg: ${formatEther(avgCost)} ETH\n\n`;
  }

  message += `---\n\n`;
  message += `**Summary:**\n`;
  message += `Total Operations: ${totalOperations}\n`;
  message += `Total Spent: ${formatEther(budget.totalSpent)} ETH\n`;
  message += `Current Balance: ${formatUnits(budget.balance, 6)} USDC\n`;

  await handler.sendMessage(channelId, message);
}
