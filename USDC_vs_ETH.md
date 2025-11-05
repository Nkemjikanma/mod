# USDC vs ETH in ModBot: Understanding the Dual-Currency System

## Overview

ModBot uses a **dual-currency budget system**:
- 💵 **USDC** - What users tip to fund their space budget
- ⛽ **ETH** - What the bot spends on blockchain gas fees

This document explains why both are needed and how they work together.

---

## Why Two Currencies?

### Towns Protocol Design
- **Tips in Towns are always in USDC** (by default)
- Tips are the primary funding mechanism
- USDC is a stablecoin ($1 ≈ 1 USDC)

### Blockchain Reality
- **Gas fees on Base are paid in ETH**
- Smart contract transactions require ETH
- Role creation/assignment costs gas in ETH

### The Solution
ModBot bridges the gap:
1. **Users fund spaces with USDC** (via tips)
2. **Bot tracks USDC budget per space**
3. **Bot pays ETH gas from its own wallet**
4. **System converts/estimates USDC → ETH cost**

---

## How It Works

### Funding Flow

```
Admin tips bot 10 USDC
         ↓
Bot receives USDC tip
         ↓
onTip handler detects tip
         ↓
Checks: Is sender admin?
         ↓
Adds 10 USDC to space budget
         ↓
Space now has 10 USDC balance
```

### Expense Flow

```
User verifies (reacts ✅)
         ↓
Bot needs to assign role
         ↓
Estimates: 0.00001 ETH gas needed
         ↓
Converts: 0.00001 ETH ≈ $0.03 ≈ 0.03 USDC
         ↓
Checks: Space has 10 USDC? ✅ Yes
         ↓
Bot pays 0.00001 ETH from own wallet
         ↓
Records: Spent 0.00001 ETH (gas)
         ↓
Tracks: Space "used" 0.03 USDC worth
         ↓
Space balance: 9.97 USDC remaining
```

---

## Currency Tracking

### Space Budget (USDC)
```typescript
interface SpaceBudget {
  balance: bigint;      // USDC balance (6 decimals)
  totalSpent: bigint;   // ETH gas spent (18 decimals)
  budgetLimit: bigint;  // USDC limit
}
```

**What's tracked in USDC:**
- ✅ Space balance (what admins funded)
- ✅ Budget limits (spending caps)
- ✅ Auto-refund thresholds (low balance alerts)
- ✅ Deposits (tips and manual allocations)

**What's tracked in ETH:**
- ✅ Actual gas costs (blockchain transactions)
- ✅ Gas used (per transaction)
- ✅ Gas price (at time of transaction)
- ✅ Total ETH spent (cumulative)

### Database Schema

```sql
-- USDC tracking
balance_wei TEXT          -- Space USDC balance (6 decimals)
budget_limit_wei TEXT     -- USDC spending limit

-- ETH tracking  
total_spent_wei TEXT      -- Total ETH gas spent (18 decimals)

-- Deposits (USDC)
space_deposits.amount_wei -- USDC deposited

-- Expenses (ETH)
space_expenses.cost_wei   -- ETH gas cost
```

---

## Price Conversion

### Rough Estimate Method

The bot uses a **rough estimate** to convert ETH gas costs to USDC:

```typescript
// Estimate: 1 ETH = $3000 USDC
const ethPrice = 3000;

// Convert 0.00001 ETH to USDC
// 0.00001 ETH * $3000 = $0.03 = 0.03 USDC
```

### Why Rough Estimate?

**Pros:**
- ✅ Simple and predictable
- ✅ No external dependencies
- ✅ Fast calculations
- ✅ Conservative (overestimates)

**Cons:**
- ❌ Not real-time pricing
- ❌ ETH price fluctuates
- ❌ May be inaccurate

### Future: Price Oracle

For production, consider:
- Chainlink price feeds
- Uniswap TWAP (Time-Weighted Average Price)
- API-based pricing (CoinGecko, etc.)

---

## User Experience

### From Admin Perspective

**Funding:**
```
/tip @ModBot 50
→ "Added 50 USDC to space budget"
```

**Checking Balance:**
```
/budget status
→ "Current Balance: 50 USDC"
→ "Total Gas Spent: 0.0005 ETH"
```

**Key Points:**
- 💵 Admins think in USDC (what they tip)
- 📊 They see USDC balance (what's left)
- ⛽ Gas costs shown in ETH (for transparency)
- 💰 Rough conversion visible (~$1.50 in gas)

### From Bot Perspective

**Bot Wallet Needs:**
- 💵 Receives USDC tips (tracked per space)
- ⛽ Must have ETH for gas (global wallet)

**Important:**
- Bot wallet must maintain **ETH balance** for gas
- USDC tips don't automatically convert to ETH
- Bot operator must ensure ETH liquidity

---

## Practical Examples

### Example 1: Initial Setup

```bash
# Admin tips bot
/tip @ModBot 20
# Space budget: 20 USDC

# Admin runs setup
/setup
# Creates role, costs ~0.00002 ETH (~$0.06)
# Space budget: ~19.94 USDC
# Bot ETH wallet: -0.00002 ETH
```

### Example 2: User Verification

```bash
# 10 users verify
# Each costs ~0.00001 ETH (~$0.03)
# Total: 0.0001 ETH (~$0.30)

# Space budget: 19.94 - 0.30 = 19.64 USDC
# Bot ETH wallet: -0.0001 ETH
```

### Example 3: Running Out

```bash
# Space has 0.5 USDC left
# User tries to verify (needs ~$0.03)
# ❌ Insufficient budget warning

# Admin tips more
/tip @ModBot 10
# ✅ Now have 10.5 USDC
# User can verify
```

---

## Cost Reference

### Base L2 Gas Costs (in ETH)

| Operation | Gas Used | ETH Cost (0.1 gwei) | USD Equiv (@$3k) |
|-----------|----------|---------------------|------------------|
| Create Role | ~200,000 | ~0.00002 ETH | ~$0.06 |
| Assign Role | ~100,000 | ~0.00001 ETH | ~$0.03 |
| Remove Role | ~80,000 | ~0.000008 ETH | ~$0.024 |

### USDC Budget Recommendations

| Use Case | Recommended Budget | Covers |
|----------|-------------------|---------|
| Small community (<50) | 5 USDC | Setup + ~150 verifications |
| Medium community (<500) | 20 USDC | Setup + ~650 verifications |
| Large community (1000+) | 50 USDC | Setup + ~1650 verifications |

---

## Important Notes

### For Space Admins

✅ **DO:**
- Tip in USDC (default in Towns)
- Monitor USDC balance via `/budget status`
- Refill when balance gets low
- Understand ~$0.03 per user verification

❌ **DON'T:**
- Try to tip in ETH (bot only accepts USDC)
- Worry about ETH gas directly (bot handles it)
- Need to manage ETH yourself
- Expect 1:1 USDC to gas conversion

### For Bot Operators

✅ **DO:**
- Keep bot wallet funded with **ETH for gas**
- Monitor bot ETH balance regularly
- Understand USDC is tracked per space
- Set up alerts for low bot ETH

❌ **DON'T:**
- Let bot run out of ETH (all spaces affected)
- Confuse space USDC budgets with bot ETH
- Expect USDC tips to auto-convert to ETH
- Underfund bot wallet

---

## Checking Balances

### Space Budget (USDC)

```bash
/budget status
```

Output:
```
💰 Budget Information

Current Balance: 45.67 USDC
Total Spent (Gas): 0.0015 ETH
Budget Limit: Unlimited

Note: Budget funded in USDC, gas costs paid in ETH from bot wallet.
```

### Bot Wallet (ETH)

**Method 1: Console Logs**
```
[MOD] Bot wallet address: 0x1234...5678
```

**Method 2: Block Explorer**
- Go to https://basescan.org
- Enter bot wallet address
- View ETH balance

**Method 3: Code**
```typescript
const balance = await bot.viem.getBalance({
  address: bot.viem.account.address
});
console.log(`Bot ETH: ${formatEther(balance)}`);
```

---

## Troubleshooting

### "Insufficient budget" error

**Cause:** Space USDC balance too low

**Solution:**
```bash
/tip @ModBot 10
# or
/budget fund 10
```

### Bot transaction fails (no gas)

**Cause:** Bot wallet has no ETH

**Solution:**
- Send ETH to bot wallet address
- Bridge from mainnet: https://bridge.base.org
- Or buy directly on Base

### "I tipped ETH but nothing happened"

**Cause:** Bot only accepts USDC tips

**Solution:**
- Towns tips are in USDC by default
- Check tip currency before sending
- USDC is the stablecoin on Base

---

## Best Practices

### For Maximum Efficiency

1. **Batch Operations** - Verify multiple users at once (future feature)
2. **Monitor Gas Prices** - Run expensive ops when gas is low (future feature)
3. **Set Thresholds** - Auto-alert when balance drops below X USDC
4. **Regular Refills** - Don't let spaces run dry
5. **Track Spending** - Use `/budget breakdown` to optimize

### For Bot Operators

1. **Maintain 0.1+ ETH** in bot wallet at all times
2. **Monitor across all spaces** - Many spaces = more gas usage
3. **Set up alerts** for bot wallet < 0.05 ETH
4. **Consider gas optimization** - L2 is cheap but adds up
5. **Document bot address** for easy refilling

---

## Future Enhancements

### Planned Features

- [ ] **Real-time price oracle** - Accurate USDC/ETH conversion
- [ ] **Gas optimization** - Wait for low gas periods
- [ ] **Batch operations** - Verify multiple users in one tx
- [ ] **USDC → ETH swap** - Auto-convert when bot low on gas
- [ ] **Multi-currency support** - Accept other stablecoins
- [ ] **Dynamic pricing** - Adjust estimates based on market

---

## Summary

| Aspect | USDC | ETH |
|--------|------|-----|
| **Purpose** | Space budget funding | Gas fee payment |
| **Source** | Admin tips | Bot wallet |
| **Tracking** | Per-space | Global (bot) |
| **User sees** | Balance, deposits | Gas costs |
| **Decimals** | 6 (1000000 = 1 USDC) | 18 (10^18 wei = 1 ETH) |
| **Stability** | Stable ($1) | Volatile (~$3000) |
| **Management** | Space admins | Bot operator |

**Remember:**
- 💵 **Tip in USDC** → Funds your space
- ⛽ **Bot spends ETH** → Pays gas fees  
- 📊 **Both tracked** → Complete transparency
- 💰 **Rough conversion** → ~$0.03 per verification

---

**Questions?** Check the main documentation or run `/help` in your Town.

**Version:** 1.0.0  
**Last Updated:** 2024