# Fund Verification System

## Overview

ModBot implements a **cryptographically verified fund allocation system** that prevents admins from allocating funds they don't actually have. Every manual allocation is verified against the bot's actual on-chain USDC balance.

---

## The Problem

Without verification, admins could:
- ❌ Claim to have sent USDC without actually sending it
- ❌ Allocate more USDC than the bot has
- ❌ Over-allocate across multiple spaces
- ❌ Create "phantom budgets" with no backing funds

**Example attack:**
```bash
# Admin claims to fund without actually sending
/budget fund 1000
# Space shows 1000 USDC balance
# But bot has 0 USDC!
# Verification would fail when trying to use funds
```

---

## The Solution

ModBot verifies **every manual allocation** by:

1. ✅ Reading bot's actual USDC balance from blockchain
2. ✅ Calculating total USDC already allocated to all spaces
3. ✅ Computing available (unallocated) USDC
4. ✅ Rejecting allocation if insufficient unallocated funds
5. ✅ Only proceeding if verification passes

---

## How It Works

### Step 1: Check On-Chain Balance

```typescript
// Read actual USDC balance from Base blockchain
const actualBalance = await readContract(bot.viem, {
  address: USDC_ADDRESS, // 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [bot.viem.account.address],
});
// Example: 150 USDC
```

### Step 2: Calculate Total Allocated

```sql
-- Sum all USDC allocated across all spaces
SELECT SUM(balance_wei) as total FROM towns;
-- Example: 120 USDC allocated
```

### Step 3: Compute Available

```typescript
const unallocated = actualBalance - totalAllocated;
// 150 USDC - 120 USDC = 30 USDC available
```

### Step 4: Verify Request

```typescript
// Admin requests to allocate 50 USDC
if (requestedAmount > unallocated) {
  // REJECT: Only 30 USDC available
  throw new Error("Insufficient unallocated USDC");
}
// APPROVE: Request is within available funds
```

### Step 5: Allocate

```typescript
// Only after verification passes
depositToSpace(spaceId, amount, "admin_allocation");
```

---

## Commands

### `/budget fund <amount>` - Manual Allocation with Verification

Allocates USDC to a space **only after verifying** bot has the funds.

**Usage:**
```bash
/budget fund 20
```

**What happens:**
1. ⏳ Bot checks on-chain USDC balance
2. ⏳ Calculates available unallocated USDC
3. ✅ Verifies request is within available
4. ✅ Allocates funds to space
5. 📊 Shows updated balances

**Success Output:**
```
✅ Added 20 USDC to space budget!

New Space Balance: 20 USDC
Total Gas Spent: 0 ETH

Remaining Unallocated: 30 USDC

✅ Verified: Bot has sufficient USDC on-chain
```

**Failure Output:**
```
❌ Cannot allocate funds

Insufficient unallocated USDC. 
Available: 5 USDC, Requested: 20 USDC

Available to allocate: 5 USDC

How to add more:
1. Send USDC to bot wallet: 0x...
2. Or use /tip @ModBot <amount> (automatic)

Use /budget balance to check bot's on-chain balance.
```

---

### `/budget balance` - Check Bot's Actual USDC

Queries the blockchain to show bot's real USDC balance.

**Usage:**
```bash
/budget balance
```

**Output:**
```
💰 Bot USDC Balance Report

On-Chain Balance: 150 USDC
Total Allocated: 120 USDC
Available to Allocate: 30 USDC

✅ Bot has sufficient unallocated USDC

Bot Wallet Address:
0x1234567890abcdef1234567890abcdef12345678

To add funds:
• Send USDC (Base) to the address above
• Or use /tip @ModBot <amount> (automatic)

Check on BaseScan: https://basescan.org/address/0x...
```

---

## Verification Flow Diagram

```
Admin: /budget fund 50
         ↓
Bot: Check on-chain balance
         ↓
    Blockchain Query
    USDC.balanceOf(bot)
         ↓
    Returns: 150 USDC
         ↓
Bot: Check total allocated
         ↓
    Database Query
    SUM(all space balances)
         ↓
    Returns: 120 USDC
         ↓
Bot: Calculate available
         ↓
    150 - 120 = 30 USDC
         ↓
Bot: Verify request
         ↓
    50 USDC > 30 USDC?
         ↓
    ❌ YES - REJECT
         ↓
    Show error + available
```

---

## Security Benefits

### 1. **Prevents Over-Allocation**
Admins cannot allocate more than bot actually has.

### 2. **Cryptographic Verification**
Uses blockchain as source of truth (can't be faked).

### 3. **Multi-Space Protection**
Prevents one space from draining all bot's USDC.

### 4. **Real-Time Checks**
Verifies at allocation time (not just setup).

### 5. **Transparent**
Anyone can verify bot's balance on BaseScan.

---

## Comparison: Tips vs Manual Allocation

### Tips (Automatic & Safe) ✅

```bash
/tip @ModBot 10
```

**Flow:**
```
User sends 10 USDC via Towns
         ↓
Transaction on blockchain
         ↓
Bot receives 10 USDC
         ↓
onTip event fires
         ↓
VERIFIED: Bot received funds
         ↓
Auto-allocate to space
         ↓
✅ Safe - funds confirmed
```

**No verification needed** because:
- Transaction already happened on-chain
- Bot definitely received the USDC
- Towns guarantees tip delivery

---

### Manual Allocation (Requires Verification) ⚠️

```bash
/budget fund 10
```

**Flow:**
```
Admin claims to have sent 10 USDC
         ↓
NO automatic confirmation
         ↓
Bot must verify on-chain
         ↓
Check actual balance
         ↓
Verify funds available
         ↓
Only then allocate
         ↓
✅ Safe - verified first
```

**Verification required** because:
- No guarantee funds were sent
- Admin could be mistaken or dishonest
- Must check blockchain as source of truth

---

## Example Scenarios

### Scenario 1: Honest Admin

```bash
# Admin sends 50 USDC to bot wallet
# (Transaction: 0xabc123...)

# Wait for confirmation (~5 seconds)

# Now allocate
/budget fund 50
```

**Result:**
```
⏳ Verifying bot balance...
✅ Added 50 USDC to space budget!
```

✅ **Success** - Funds verified on-chain

---

### Scenario 2: Forgot to Send

```bash
# Admin forgot to actually send USDC
/budget fund 50
```

**Result:**
```
⏳ Verifying bot balance...
❌ Cannot allocate funds

Insufficient unallocated USDC.
Available: 0 USDC, Requested: 50 USDC
```

✅ **Protected** - Caught the mistake

---

### Scenario 3: Typo in Amount

```bash
# Admin sent 5 USDC but types 50
/budget fund 50
```

**Result:**
```
⏳ Verifying bot balance...
❌ Cannot allocate funds

Insufficient unallocated USDC.
Available: 5 USDC, Requested: 50 USDC
```

✅ **Protected** - Verification caught discrepancy

---

### Scenario 4: Multiple Spaces

```bash
# Bot has 100 USDC total
# Space A already allocated: 70 USDC
# Space B tries to allocate: 50 USDC

# In Space B:
/budget fund 50
```

**Result:**
```
⏳ Verifying bot balance...
❌ Cannot allocate funds

Insufficient unallocated USDC.
Available: 30 USDC, Requested: 50 USDC
```

✅ **Protected** - Can't over-allocate across spaces

---

## Technical Implementation

### Reading On-Chain Balance

```typescript
import { readContract } from "viem/actions";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

export async function getBotUsdcBalance(bot: any): Promise<bigint> {
  const balance = await readContract(bot.viem, {
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [bot.viem.account.address],
  });

  return balance; // Returns amount in smallest unit (6 decimals)
}
```

### Calculating Total Allocated

```typescript
export function getTotalAllocatedUsdc(): bigint {
  const result = db
    .query("SELECT SUM(CAST(balance_wei AS INTEGER)) as total FROM towns")
    .get() as any;

  return BigInt(result?.total || 0);
}
```

### Verification Logic

```typescript
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
```

---

## Best Practices

### For Admins

✅ **DO:**
- Check `/budget balance` before manual allocation
- Use tips when possible (automatic verification)
- Send USDC first, then allocate
- Verify transaction confirmed on-chain before allocating
- Double-check amounts

❌ **DON'T:**
- Allocate without sending funds first
- Guess amounts
- Rely on memory of what you sent
- Try to allocate immediately after sending (wait for confirmation)

### For Bot Operators

✅ **DO:**
- Monitor total allocations vs bot balance
- Set up alerts for discrepancies
- Regularly audit with `/budget balance`
- Keep bot wallet funded with USDC
- Document bot wallet address

❌ **DON'T:**
- Manually edit database allocations
- Ignore allocation vs balance warnings
- Let unallocated go negative
- Forget to fund bot wallet

---

## Troubleshooting

### "Insufficient unallocated USDC"

**Cause:** Bot doesn't have enough USDC

**Solutions:**
1. Check if USDC was actually sent: https://basescan.org
2. Verify transaction confirmed (not pending)
3. Check you sent to correct address: `/budget balance`
4. Wait for blockchain confirmation (~5 seconds)
5. Use tips instead: `/tip @ModBot <amount>`

---

### "Failed to check bot balance"

**Cause:** Network issue or RPC error

**Solutions:**
1. Try again in a few seconds
2. Check Base network status
3. Verify bot is running
4. Check bot has network connectivity

---

### Unallocated Balance Negative

**Cause:** Database corruption or bug

**Solutions:**
1. Check `/budget balance` for actual numbers
2. Contact bot operator
3. May need database audit/fix
4. Don't allocate more until resolved

---

## Monitoring & Auditing

### Regular Checks

Run these regularly to ensure system health:

```bash
# Check bot's actual balance
/budget balance

# Check specific space
/budget status

# View all deposits
/budget deposits

# View all expenses
/budget expenses
```

### Red Flags

⚠️ **Warning signs:**
- Available < 0 (more allocated than bot has)
- Large discrepancy between allocated and actual
- Repeated allocation failures
- Unallocated decreasing without space allocations

---

## Comparison to Other Systems

### Traditional Database-Only

❌ **No verification** - Trust database
❌ **No proof** - Can't verify funds exist
❌ **Easy to fake** - Modify database

### ModBot Verification System

✅ **Blockchain proof** - Source of truth
✅ **Real-time checks** - Verify each allocation
✅ **Transparent** - Anyone can audit on BaseScan
✅ **Cryptographic** - Can't be faked

---

## Future Enhancements

Planned improvements:

- [ ] **Transaction hash verification** - Verify specific tx
- [ ] **Automatic USDC → ETH swap** - For gas fees
- [ ] **Multi-token support** - Other stablecoins
- [ ] **Price oracle integration** - Real-time ETH pricing
- [ ] **Automated audits** - Daily balance checks
- [ ] **Discord alerts** - Low balance notifications

---

## Summary

**Key Points:**

1. 💵 **Tips are automatic** - No verification needed (already on-chain)
2. 🔍 **Manual allocation verified** - Must check blockchain first
3. ✅ **Prevents fraud** - Can't allocate phantom funds
4. 📊 **Transparent** - Anyone can verify on BaseScan
5. 🔐 **Cryptographically secure** - Uses blockchain as truth

**Best Practice:**
```bash
# Recommended: Use tips (automatic & safe)
/tip @ModBot 50

# Alternative: Manual (requires verification)
# 1. Send USDC to bot wallet
# 2. Wait for confirmation
# 3. Verify balance
/budget balance
# 4. Allocate
/budget fund 50
```

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**See also:** USDC_vs_ETH.md, IMPLEMENTATION.md