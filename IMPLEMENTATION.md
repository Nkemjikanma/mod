# ModBot Implementation Documentation

## Overview

ModBot is an advanced moderation bot for Towns protocol featuring:
- **Hybrid Budget Management** - Per-space budget tracking with multiple funding methods
- **On-Chain Role Assignment** - Blockchain-verified "Verified Member" roles
- **Automated Moderation** - Profanity filtering, spam detection, and warning system
- **Complete Audit Trail** - Track all expenses and operations on-chain and in database

## Architecture

### Key Components

```
┌─────────────────────────────────────────────────────────────┐
│                         ModBot                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Bot Core   │  │   Budget     │  │  Web3/Roles  │      │
│  │              │  │  Management  │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         ├──────────────────┼──────────────────┤              │
│         │                  │                  │              │
│  ┌──────▼──────┐  ┌────────▼────────┐ ┌──────▼──────┐      │
│  │  Handlers   │  │   Database      │ │ Space       │      │
│  │  - Messages │  │   - SQLite      │ │ Contract    │      │
│  │  - Reactions│  │   - Budget      │ │ - Roles     │      │
│  │  - Tips     │  │   - Expenses    │ │ - Entitle.  │      │
│  │  - Commands │  │   - Deposits    │ │             │      │
│  └─────────────┘  └─────────────────┘ └─────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Joins Channel** → Welcome message sent → User reacts with ✅
2. **Reaction Detected** → Check if setup complete
3. **If Setup Complete** → Deduct from budget → Assign on-chain role → Update database
4. **If Setup Incomplete** → Database-only verification

## Complete Setup Flow

### Phase 1: Initial Funding

```bash
# Admin tips the bot (Recommended)
/tip @ModBot 0.05

# OR manually allocate funds
/budget fund 0.05
```

**What happens:**
- For tips: Automatically credited to space budget
- For manual: Admin allocates from bot's wallet
- Budget tracked in `space_deposits` table
- Space balance updated

### Phase 2: On-Chain Setup

```bash
# Admin runs setup command
/setup
```

**What happens:**
1. ✅ Verifies admin permissions
2. ✅ Checks budget sufficiency (~0.00002 ETH needed)
3. ✅ Fetches UserEntitlement module address
4. ✅ Creates "Verified Member" role on-chain
5. ✅ Records expense in database
6. ✅ Marks setup as complete

**On-chain transaction includes:**
- Role Name: "Verified Member"
- Permissions: Read, Write, React, PinMessage
- Gas cost: ~150-200k gas (~0.00001-0.00002 ETH on Base)

### Phase 3: User Verification

```bash
# User joins channel
# Bot sends welcome message
# User reacts with ✅
```

**What happens:**
1. ✅ Bot detects reaction on welcome message
2. ✅ Checks if user already verified
3. ✅ Verifies budget availability (~0.00001 ETH)
4. ✅ Assigns role via UserEntitlement module
5. ✅ Records expense transaction
6. ✅ Updates user's database label
7. ✅ Sends confirmation message

## Budget Management System

### Budget Tracking

Each space has its own isolated budget:

```typescript
interface SpaceBudget {
  spaceId: string;
  balance: bigint;              // Available ETH
  totalSpent: bigint;           // Total spent on operations
  budgetLimit: bigint | null;   // Optional spending cap
  autoRefundThreshold: bigint | null; // Low balance alert
  setupCompleted: boolean;      // On-chain setup status
}
```

### Expense Tracking

Every operation is tracked:

```typescript
interface Expense {
  id: number;
  spaceId: string;
  transactionHash: string;
  operationType: string;        // 'create_role', 'assign_role', etc.
  gasUsed: number;
  gasPriceWei: bigint;
  costWei: bigint;              // Actual cost
  description: string;
  timestamp: number;
  userId: string;               // Who triggered it
  status: string;               // 'completed', 'failed', 'pending'
}
```

### Expense Flow

1. **Pending** - Operation initiated, estimated cost deducted
2. **Transaction Sent** - Waiting for blockchain confirmation
3. **Completed** - Transaction confirmed, actual cost calculated
4. **Adjustment** - Difference between estimated and actual refunded/charged

### Funding Methods

#### Method 1: Tipping (Recommended) ✨

```bash
# Admin tips the bot
/tip @ModBot <amount>
```

**Pros:**
- ✅ Automatic attribution to space
- ✅ Instant credit
- ✅ Works through Towns UI
- ✅ Clear audit trail

**Flow:**
```
User tips bot → onTip handler → Check if admin → 
depositToSpace() → Update balance → Confirmation message
```

#### Method 2: Manual Allocation 🔧

```bash
# Admin manually allocates
/budget fund <amount>
```

**Pros:**
- ✅ Direct control
- ✅ Can allocate from existing bot balance
- ✅ No blockchain transaction needed

**Use case:** Bot owner pre-funds spaces or admin has already sent ETH

#### Method 3: Direct Transfer 📤

```bash
# Send ETH to bot wallet
# Then manually allocate
Send to: <bot_wallet_address>
/budget fund <amount>
```

**Pros:**
- ✅ Standard wallet transfer
- ✅ Works with any wallet

**Cons:**
- ❌ Requires manual step to allocate
- ❌ Not automatically attributed

## Commands Reference

### Admin Commands

#### `/setup`
**Purpose:** Initialize on-chain role system  
**Usage:** `/setup`  
**Requirements:** 
- Admin permissions
- ~0.00002 ETH in space budget
- Bot has ModifyRoles permission

**What it does:**
1. Creates "Verified Member" role on-chain
2. Stores role ID in database
3. Enables automatic role assignment

**Output:**
```
✅ ModBot Setup Complete! 🎉

On-Chain Role Created:
🏷️ Name: Verified Member
🆔 Role ID: 1
📝 Transaction: 0xabcd...
💰 Cost: 0.000015 ETH

Budget Status:
Balance: 0.049985 ETH
Total Spent: 0.000015 ETH
```

---

#### `/fund`
**Purpose:** View funding options  
**Usage:** `/fund`  
**Requirements:** None (info for admins)

**Shows:**
- Current budget status
- Three funding methods
- Estimated costs
- How-to instructions

---

#### `/budget [subcommand]`
**Purpose:** Manage space budget  
**Subcommands:**

**`/budget status`** - View current budget
```
💰 Budget Information

Current Balance: 0.045 ETH
Total Spent: 0.005 ETH
Budget Limit: Unlimited
Setup: ✅ Complete
```

**`/budget fund <amount>`** - Manually allocate funds
```
/budget fund 0.1
✅ Added 0.1 ETH to space budget!
```

**`/budget expenses [limit]`** - View expense history
```
/budget expenses 10
📊 Recent Expenses (showing 10)

✅ assign_role - 0.00001 ETH
   Nov 28, 2024, 10:30 AM
   Assign role 1 to 0x1234...
   TX: 0xabcd1234...
```

**`/budget deposits`** - View deposit history
```
💵 Deposit History (last 10)

+0.05 ETH - tip_funding
  Nov 28, 2024, 10:00 AM
  Tip from userId123
```

**`/budget limit <amount|none>`** - Set spending limit
```
/budget limit 0.5
✅ Budget limit set to 0.5 ETH
```

**`/budget threshold <amount|none>`** - Set low balance alert
```
/budget threshold 0.01
✅ Auto-refund threshold set to 0.01 ETH
```

**`/budget estimate <operation>`** - Estimate operation cost
```
/budget estimate create_role
💰 Cost Estimate

Operation: Creating a new role on-chain
Estimated Cost: ~0.00002 ETH
```

**`/budget breakdown`** - View expenses by operation type
```
📊 Expense Breakdown

create_role
  Count: 1 operations
  Total: 0.000015 ETH
  Avg: 0.000015 ETH

assign_role
  Count: 5 operations
  Total: 0.00005 ETH
  Avg: 0.00001 ETH
```

---

#### `/ban @user [reason]`
**Purpose:** Ban user from space  
**Requirements:** Admin permissions

```
/ban @spammer repeatedly violated rules
🔨 Banned @spammer: repeatedly violated rules
```

---

#### `/unban @user`
**Purpose:** Unban user  
**Requirements:** Admin permissions

```
/unban @user
✅ Unbanned @user
```

---

#### `/warn @user [reason]`
**Purpose:** Manually issue warning  
**Requirements:** Admin permissions

```
/warn @user inappropriate behavior
⚠️ @user has been warned (2/3): inappropriate behavior
```

---

#### `/kick @user [reason]`
**Purpose:** Remove from all channels  
**Requirements:** Admin permissions

```
/kick @user violation
👢 Kicked @user: violation
```

---

#### `/infractions @user`
**Purpose:** View user's infraction history  
**Requirements:** Admin permissions

```
/infractions @user
Infractions for @user:
• profanity — "bad word here" (Nov 28, 2024, 10:30 AM)
• spam — "repeated message" (Nov 28, 2024, 10:25 AM)
```

---

#### `/settings [key] [value]`
**Purpose:** Configure moderation settings  
**Requirements:** Admin permissions

**View settings:**
```
/settings
Current Settings:
{
  "profanityFilter": true,
  "autoWarn": true,
  "warnAfter": 3,
  "spamDetection": true
}
```

**Update setting:**
```
/settings warnAfter 5
✅ Updated setting "warnAfter" → 5
```

**Available settings:**
- `profanityFilter` (true/false) - Enable profanity detection
- `autoWarn` (true/false) - Automatically warn users
- `warnAfter` (number) - Warnings before auto-label
- `spamDetection` (true/false) - Enable spam detection

---

#### `/mute-label <label>`
**Purpose:** Ban all users with specific label  
**Requirements:** Admin permissions

```
/mute-label needs-review
🔇 Muted 3 user(s) labeled "needs-review".
```

---

### User Commands

#### `/mywarnings`
**Purpose:** View your own warnings  
**Usage:** `/mywarnings`  
**Requirements:** Verified member

```
/mywarnings
⚠️ Your Warnings (2 total)

• profanity — Nov 28, 2024, 10:30 AM
  "inappropriate word"
• spam — Nov 28, 2024, 10:25 AM
  "repeated message"
```

---

#### `/help`
**Purpose:** Get help with bot commands  
**Usage:** `/help`

Shows comprehensive help based on user role (admin vs regular user).

---

## Database Schema

### `towns` Table
```sql
CREATE TABLE towns (
    town_id TEXT PRIMARY KEY,
    profanity_filter INTEGER DEFAULT 1,
    auto_warn INTEGER DEFAULT 1,
    warn_after INTEGER DEFAULT 3,
    spam_detection INTEGER DEFAULT 1,
    verified_role_id TEXT DEFAULT NULL,
    user_entitlement_module TEXT DEFAULT NULL,
    balance_wei TEXT DEFAULT '0',
    total_spent_wei TEXT DEFAULT '0',
    budget_limit_wei TEXT DEFAULT NULL,
    auto_refund_threshold_wei TEXT DEFAULT NULL,
    setup_completed INTEGER DEFAULT 0
);
```

### `space_expenses` Table
```sql
CREATE TABLE space_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    town_id TEXT NOT NULL,
    transaction_hash TEXT,
    operation_type TEXT NOT NULL,
    gas_used INTEGER,
    gas_price_wei TEXT,
    cost_wei TEXT NOT NULL,
    description TEXT,
    timestamp INTEGER NOT NULL,
    user_id TEXT,
    status TEXT DEFAULT 'completed',
    FOREIGN KEY (town_id) REFERENCES towns(town_id)
);
```

### `space_deposits` Table
```sql
CREATE TABLE space_deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    town_id TEXT NOT NULL,
    amount_wei TEXT NOT NULL,
    depositor_address TEXT,
    transaction_hash TEXT,
    timestamp INTEGER NOT NULL,
    method TEXT,
    note TEXT,
    FOREIGN KEY (town_id) REFERENCES towns(town_id)
);
```

## Code Structure

```
mod/
├── src/
│   ├── bot.ts                 # Main bot file with handlers
│   ├── commands.ts            # Command definitions
│   ├── types.ts               # TypeScript interfaces
│   │
│   ├── commands/              # Command handlers
│   │   ├── setup.ts          # On-chain setup
│   │   ├── budget.ts         # Budget management
│   │   ├── fund.ts           # Funding instructions
│   │   ├── ban.ts            # Ban command
│   │   ├── unban.ts          # Unban command
│   │   ├── warn.ts           # Warn command
│   │   ├── kick.ts           # Kick command
│   │   ├── infractions.ts    # View infractions
│   │   ├── myWarnings.ts     # User warnings
│   │   ├── muteLabel.ts      # Label-based muting
│   │   └── settings.ts       # Settings management
│   │
│   ├── modules/               # Core functionality
│   │   ├── budget.ts         # Budget tracking system
│   │   ├── profanity.ts      # Profanity detection
│   │   └── spam.ts           # Spam detection
│   │
│   ├── web3/                  # Blockchain interactions
│   │   └── spaceRoles.ts     # Role management
│   │
│   ├── utils/                 # Utilities
│   │   ├── permissions.ts    # Permission checks
│   │   └── botMentions.ts    # Bot mention handler
│   │
│   └── db/                    # Database
│       ├── index.ts          # Database functions
│       └── schema.sql        # Database schema
│
├── data/
│   └── modbot.db             # SQLite database
│
└── package.json
```

## Gas Costs (Base L2)

| Operation | Estimated Gas | Est. Cost (0.1 gwei) |
|-----------|--------------|---------------------|
| Create Role | ~200,000 | ~0.00002 ETH |
| Assign Role | ~100,000 | ~0.00001 ETH |
| Remove Role | ~80,000 | ~0.000008 ETH |

**Note:** Base L2 has extremely low gas fees compared to Ethereum mainnet.

## Error Handling

### Insufficient Budget
```
❌ Setup failed: Insufficient budget

Required: ~0.00002 ETH
Available: 0 ETH

How to fund your space:
1️⃣ Tip the bot: /tip @ModBot <amount>
2️⃣ View options: /fund
3️⃣ Manual: /budget fund <amount>
```

### Transaction Failed
```
⚠️ Verification completed (database only)

On-chain role assignment failed: transaction reverted

Welcome anyway, @user! 👋
```

### Permission Denied
```
⛔ Only space admins can run setup.
```

## Troubleshooting

### Issue: Setup fails with "Could not find UserEntitlement module"

**Solution:** The Space contract may not have entitlement modules deployed. This is rare but can happen with very old Spaces. Contact Towns support or create a new Space.

---

### Issue: Role assignment fails but balance is deducted

**Solution:** The expense is marked as "failed" and balance is NOT actually deducted. Check `/budget expenses` - failed transactions show ❌ and don't affect balance.

---

### Issue: Bot running out of ETH

**Solution:** The bot needs ETH in its wallet to pay gas fees. Each space has a virtual budget, but the actual ETH comes from the bot's wallet. Monitor bot wallet balance and refill when needed.

---

### Issue: User verification not working

**Checklist:**
1. ✅ Is setup complete? Check `/budget status`
2. ✅ Is there budget? Check balance
3. ✅ Is user reacting to the correct welcome message?
4. ✅ Check bot logs for errors

---

### Issue: "Bot lacks ModifyRoles permission"

**Solution:** The Space owner must grant the bot the `ModifyRoles` permission. This is done through the Space contract or Towns UI (if available).

## Security Considerations

1. **Budget Isolation** - Each space has isolated budget, preventing one space from draining another's funds
2. **Admin-Only** - Funding and budget management restricted to space admins
3. **Transaction Verification** - All transactions verified on-chain before marking as complete
4. **Audit Trail** - Complete history of all expenses and deposits
5. **Permission Checks** - All admin commands verify permissions before execution

## Production Checklist

- [ ] Set environment variables (`PRIVATE_DATA`, `JWT_SECRET`)
- [ ] Fund bot wallet with ETH for gas fees
- [ ] Test in a test Space first
- [ ] Monitor bot wallet balance
- [ ] Set up alerts for low bot balance
- [ ] Document bot wallet address for admins
- [ ] Create backup strategy for database
- [ ] Set budget limits for untrusted spaces
- [ ] Monitor expense patterns for anomalies

## Future Enhancements

- [ ] Multi-signature budget approvals
- [ ] Automated budget refills from treasury
- [ ] Role-based permission tiers (Silver, Gold, Platinum)
- [ ] Batch role assignments for existing users
- [ ] Gas price optimization (wait for low gas)
- [ ] Alternative L2 support (Optimism, Arbitrum)
- [ ] Budget alerts via DMs
- [ ] Expense analytics dashboard
- [ ] Role expiration/renewal system
- [ ] Integration with other DeFi protocols

## Support

For issues or questions:
1. Check bot logs: `bun run dev`
2. Check database: `sqlite3 data/modbot.db`
3. Verify transactions on Base explorer: https://basescan.org
4. Review this documentation
5. Contact Towns Protocol support: https://docs.towns.com

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**License:** MIT