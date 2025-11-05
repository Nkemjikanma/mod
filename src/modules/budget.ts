import { db } from "../db/index";
import { formatEther, parseEther, formatUnits, parseUnits } from "viem";
import { readContract } from "viem/actions";

// USDC address on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

// Minimal ERC20 ABI for balance checking
const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

export interface SpaceBudget {
  spaceId: string;
  balance: bigint; // USDC balance (6 decimals)
  totalSpent: bigint; // ETH spent on gas (18 decimals)
  budgetLimit: bigint | null; // USDC limit
  autoRefundThreshold: bigint | null; // USDC threshold
  setupCompleted: boolean;
}

export interface Expense {
  id: number;
  spaceId: string;
  transactionHash: string | null;
  operationType: string;
  gasUsed: number | null;
  gasPriceWei: bigint | null;
  costWei: bigint; // ETH cost in wei
  description: string | null;
  timestamp: number;
  userId: string | null;
  status: string;
}

export interface Deposit {
  id: number;
  spaceId: string;
  amountWei: bigint; // USDC amount (6 decimals)
  depositorAddress: string | null;
  transactionHash: string | null;
  timestamp: number;
  method: string;
  note: string | null;
}

/**
 * Get the current budget for a space
 */
export function getSpaceBudget(spaceId: string): SpaceBudget {
  const row = db
    .query(
      "SELECT balance_wei, total_spent_wei, budget_limit_wei, auto_refund_threshold_wei, setup_completed FROM towns WHERE town_id = ?"
    )
    .get(spaceId) as any;

  if (!row) {
    throw new Error(`Space ${spaceId} not found`);
  }

  return {
    spaceId,
    balance: BigInt(row.balance_wei || "0"), // USDC balance
    totalSpent: BigInt(row.total_spent_wei || "0"), // ETH spent
    budgetLimit: row.budget_limit_wei ? BigInt(row.budget_limit_wei) : null,
    autoRefundThreshold: row.auto_refund_threshold_wei
      ? BigInt(row.auto_refund_threshold_wei)
      : null,
    setupCompleted: !!row.setup_completed,
  };
}

/**
 * Check if a space has sufficient USDC budget
 * We need to estimate the USDC value needed for ETH gas costs
 */
export function hasSpaceBudget(spaceId: string, requiredEthWei: bigint): boolean {
  const budget = getSpaceBudget(spaceId);

  // Convert required ETH to approximate USDC cost
  // Rough estimate: 1 ETH = $3000 USDC
  // This should ideally use a price oracle or be configurable
  const usdcNeeded = estimateUsdcForEth(requiredEthWei);

  return budget.balance >= usdcNeeded;
}

/**
 * Estimate USDC cost for ETH amount
 * This is a rough estimate - in production, use price oracle
 */
function estimateUsdcForEth(ethWei: bigint): bigint {
  // Rough estimate: 1 ETH = $3000 USDC
  // ETH has 18 decimals, USDC has 6 decimals
  const ethPrice = 3000n; // $3000 per ETH

  // Convert wei to ETH, multiply by price, convert to USDC (6 decimals)
  // ethWei / 10^18 * 3000 * 10^6
  // = ethWei * 3000 * 10^6 / 10^18
  // = ethWei * 3000 / 10^12

  const usdcAmount = (ethWei * ethPrice) / parseEther("1") * parseUnits("1", 6);

  return usdcAmount;
}

/**
 * Estimate gas cost for an operation in ETH
 */
export function estimateOperationCost(operationType: string): bigint {
  // Base gas estimates (measured on Base)
  const gasEstimates: Record<string, bigint> = {
    create_role: BigInt(200000), // ~200k gas for creating a role
    assign_role: BigInt(100000), // ~100k gas for assigning role to one user
    remove_role: BigInt(80000), // ~80k gas for removing role from user
    batch_assign: BigInt(80000), // Base cost for batch operations
  };

  // Estimate gas price on Base (usually very cheap, ~0.01-0.1 gwei)
  // Using 0.1 gwei as conservative estimate
  const estimatedGasPrice = parseEther("0.0000000001"); // 0.1 gwei in wei

  const gasEstimate = gasEstimates[operationType] || BigInt(100000);
  return gasEstimate * estimatedGasPrice;
}

/**
 * Get bot's actual USDC balance from blockchain
 */
export async function getBotUsdcBalance(bot: any): Promise<bigint> {
  try {
    const balance = await readContract(bot.viem, {
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [bot.viem.account.address],
    });

    return balance as bigint;
  } catch (err) {
    console.error("[Budget] Failed to get bot USDC balance:", err);
    throw new Error("Failed to check bot USDC balance");
  }
}

/**
 * Get total USDC allocated across all spaces
 */
export function getTotalAllocatedUsdc(): bigint {
  const result = db
    .query(
      "SELECT SUM(CAST(balance_wei AS INTEGER)) as total FROM towns"
    )
    .get() as any;

  return BigInt(result?.total || 0);
}

/**
 * Get unallocated USDC (bot balance - total allocated)
 */
export async function getUnallocatedUsdc(bot: any): Promise<bigint> {
  const actualBalance = await getBotUsdcBalance(bot);
  const allocated = getTotalAllocatedUsdc();

  return actualBalance - allocated;
}

/**
 * Check if bot has enough unallocated USDC for allocation
 */
export async function canAllocateUsdc(
  bot: any,
  amountUsdc: bigint
): Promise<{ canAllocate: boolean; reason?: string; available: bigint }> {
  const actualBalance = await getBotUsdcBalance(bot);
  const allocated = getTotalAllocatedUsdc();
  const available = actualBalance - allocated;

  if (available < amountUsdc) {
    return {
      canAllocate: false,
      reason: `Insufficient unallocated USDC. Available: ${formatUnits(available, 6)} USDC, Requested: ${formatUnits(amountUsdc, 6)} USDC`,
      available,
    };
  }

  return { canAllocate: true, available };
}

/**
 * Add USDC funds to a space's budget (from tips or manual allocation)
 * Note: For tips, this is safe as we verified the tip was received
 * For manual allocation, caller should verify with canAllocateUsdc first
 */
export function depositToSpace(
  spaceId: string,
  amountUsdc: bigint, // USDC amount (6 decimals)
  depositorAddress: string | null = null,
  transactionHash: string | null = null,
  method: string = "admin_allocation",
  note: string | null = null
): void {
  const budget = getSpaceBudget(spaceId);
  const newBalance = budget.balance + amountUsdc;

  // Update space balance
  db.query("UPDATE towns SET balance_wei = ? WHERE town_id = ?").run(
    newBalance.toString(),
    spaceId
  );

  // Record the deposit
  db.query(
    "INSERT INTO space_deposits (town_id, amount_wei, depositor_address, transaction_hash, timestamp, method, note) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    spaceId,
    amountUsdc.toString(),
    depositorAddress,
    transactionHash,
    Date.now(),
    method,
    note
  );

  console.log(
    `[Budget] Added ${formatUnits(amountUsdc, 6)} USDC to space ${spaceId}. New balance: ${formatUnits(newBalance, 6)} USDC`
  );
}

/**
 * Record an expense for a space (pending)
 */
export function recordPendingExpense(
  spaceId: string,
  operationType: string,
  estimatedCostWei: bigint, // ETH cost in wei
  description: string | null = null,
  userId: string | null = null
): number {
  const budget = getSpaceBudget(spaceId);

  // Check if we have enough USDC to cover the estimated ETH cost
  const usdcNeeded = estimateUsdcForEth(estimatedCostWei);

  if (budget.balance < usdcNeeded) {
    throw new Error(
      `Insufficient budget. Required: ~${formatUnits(usdcNeeded, 6)} USDC (for ${formatEther(estimatedCostWei)} ETH gas), Available: ${formatUnits(budget.balance, 6)} USDC`
    );
  }

  // Record as pending expense (in ETH)
  const result = db.query(
    "INSERT INTO space_expenses (town_id, operation_type, cost_wei, description, timestamp, user_id, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
  ).run(spaceId, operationType, estimatedCostWei.toString(), description, Date.now(), userId);

  console.log(
    `[Budget] Recorded pending expense for ${spaceId}: ${operationType} - ${formatEther(estimatedCostWei)} ETH (~${formatUnits(usdcNeeded, 6)} USDC)`
  );

  return result.lastInsertRowid as number;
}

/**
 * Complete an expense with actual transaction data
 */
export function completeExpense(
  expenseId: number,
  transactionHash: string,
  gasUsed: bigint,
  gasPrice: bigint
): void {
  const actualCostEth = gasUsed * gasPrice;

  // Update expense with actual data
  db.query(
    "UPDATE space_expenses SET transaction_hash = ?, gas_used = ?, gas_price_wei = ?, cost_wei = ?, status = 'completed' WHERE id = ?"
  ).run(transactionHash, Number(gasUsed), gasPrice.toString(), actualCostEth.toString(), expenseId);

  // Get the space ID and update total spent (in ETH)
  const expense = db.query("SELECT town_id FROM space_expenses WHERE id = ?").get(expenseId) as any;

  if (expense) {
    const budget = getSpaceBudget(expense.town_id);
    const newTotalSpent = budget.totalSpent + actualCostEth;

    // Update total spent (ETH) - balance (USDC) stays the same
    db.query("UPDATE towns SET total_spent_wei = ? WHERE town_id = ?").run(
      newTotalSpent.toString(),
      expense.town_id
    );

    console.log(
      `[Budget] Completed expense ${expenseId}: actual cost ${formatEther(actualCostEth)} ETH`
    );
  }
}

/**
 * Mark an expense as failed
 */
export function failExpense(expenseId: number): void {
  db.query("UPDATE space_expenses SET status = 'failed' WHERE id = ?").run(expenseId);
  console.log(`[Budget] Marked expense ${expenseId} as failed`);
}

/**
 * Get expense history for a space
 */
export function getSpaceExpenses(spaceId: string, limit: number = 50, offset: number = 0): Expense[] {
  const rows = db
    .query(
      "SELECT * FROM space_expenses WHERE town_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    )
    .all(spaceId, limit, offset) as any[];

  return rows.map((row) => ({
    id: row.id,
    spaceId: row.town_id,
    transactionHash: row.transaction_hash,
    operationType: row.operation_type,
    gasUsed: row.gas_used,
    gasPriceWei: row.gas_price_wei ? BigInt(row.gas_price_wei) : null,
    costWei: BigInt(row.cost_wei),
    description: row.description,
    timestamp: row.timestamp,
    userId: row.user_id,
    status: row.status,
  }));
}

/**
 * Get deposit history for a space
 */
export function getSpaceDeposits(spaceId: string, limit: number = 50, offset: number = 0): Deposit[] {
  const rows = db
    .query(
      "SELECT * FROM space_deposits WHERE town_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    )
    .all(spaceId, limit, offset) as any[];

  return rows.map((row) => ({
    id: row.id,
    spaceId: row.town_id,
    amountWei: BigInt(row.amount_wei), // USDC amount
    depositorAddress: row.depositor_address,
    transactionHash: row.transaction_hash,
    timestamp: row.timestamp,
    method: row.method,
    note: row.note,
  }));
}

/**
 * Set budget limit for a space (in USDC)
 */
export function setSpaceBudgetLimit(spaceId: string, limitUsdc: bigint | null): void {
  db.query("UPDATE towns SET budget_limit_wei = ? WHERE town_id = ?").run(
    limitUsdc?.toString() || null,
    spaceId
  );

  console.log(
    `[Budget] Set budget limit for ${spaceId}: ${limitUsdc ? formatUnits(limitUsdc, 6) + " USDC" : "unlimited"}`
  );
}

/**
 * Set auto-refund threshold (in USDC)
 */
export function setAutoRefundThreshold(spaceId: string, thresholdUsdc: bigint | null): void {
  db.query("UPDATE towns SET auto_refund_threshold_wei = ? WHERE town_id = ?").run(
    thresholdUsdc?.toString() || null,
    spaceId
  );

  console.log(
    `[Budget] Set auto-refund threshold for ${spaceId}: ${thresholdUsdc ? formatUnits(thresholdUsdc, 6) + " USDC" : "disabled"}`
  );
}

/**
 * Check if space needs refunding
 */
export function needsRefund(spaceId: string): boolean {
  const budget = getSpaceBudget(spaceId);
  if (!budget.autoRefundThreshold) return false;
  return budget.balance < budget.autoRefundThreshold;
}

/**
 * Get total expenses by operation type
 */
export function getExpensesByType(
  spaceId: string
): Record<string, { count: number; total: bigint }> {
  const rows = db
    .query(
      "SELECT operation_type, COUNT(*) as count, SUM(CAST(cost_wei AS INTEGER)) as total FROM space_expenses WHERE town_id = ? AND status = 'completed' GROUP BY operation_type"
    )
    .all(spaceId) as any[];

  const result: Record<string, { count: number; total: bigint }> = {};

  for (const row of rows) {
    result[row.operation_type] = {
      count: row.count,
      total: BigInt(row.total || 0),
    };
  }

  return result;
}

/**
 * Format budget info for display
 */
export function formatBudgetInfo(budget: SpaceBudget): string {
  let info = `💰 **Budget Information**\n\n`;
  info += `**Current Balance:** ${formatUnits(budget.balance, 6)} USDC\n`;
  info += `**Total Spent (Gas):** ${formatEther(budget.totalSpent)} ETH\n`;

  if (budget.budgetLimit) {
    const percentUsed = (Number(budget.balance) / Number(budget.budgetLimit)) * 100;
    info += `**Budget Limit:** ${formatUnits(budget.budgetLimit, 6)} USDC (${(100 - percentUsed).toFixed(1)}% remaining)\n`;
  } else {
    info += `**Budget Limit:** Unlimited\n`;
  }

  if (budget.autoRefundThreshold) {
    info += `**Auto-Refund Threshold:** ${formatUnits(budget.autoRefundThreshold, 6)} USDC\n`;
    if (budget.balance < budget.autoRefundThreshold) {
      info += `\n⚠️ **Warning:** Balance is below auto-refund threshold!\n`;
    }
  }

  if (!budget.setupCompleted) {
    info += `\n⚠️ **Setup incomplete** - Run \`/setup\` to enable on-chain roles.\n`;
  }

  info += `\n_Note: Budget funded in USDC, gas costs paid in ETH from bot wallet._`;

  return info;
}

/**
 * Mark setup as completed
 */
export function markSetupCompleted(spaceId: string, roleId: bigint, entitlementModule: string): void {
  db.query(
    "UPDATE towns SET setup_completed = 1, verified_role_id = ?, user_entitlement_module = ? WHERE town_id = ?"
  ).run(roleId.toString(), entitlementModule, spaceId);

  console.log(`[Budget] Marked setup completed for space ${spaceId}`);
}
