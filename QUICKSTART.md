# ModBot Quick Start Guide

Get your ModBot up and running in 5 minutes!

## Prerequisites

- [Bun](https://bun.sh) installed (`curl -fsSL https://bun.sh/install | bash`)
- Towns Protocol account
- Space/Town where you have admin permissions
- Small amount of ETH on Base L2 (~0.01 ETH recommended)

## 1. Installation

```bash
# Clone or navigate to your mod directory
cd mod

# Install dependencies
bun install

# Create data directory
mkdir -p data
```

## 2. Configuration

Create a `.env` file:

```bash
cp .env.example .env  # If example exists, or create new
```

Add your credentials to `.env`:

```env
PRIVATE_DATA="your_towns_bot_private_data_here"
JWT_SECRET="your_jwt_secret_here"
PORT=5123
```

**How to get credentials:**
1. Go to [Towns Bot Dashboard](https://app.towns.com)
2. Create a new bot or use existing
3. Copy `PRIVATE_DATA` and `JWT_SECRET`

## 3. Run the Bot

```bash
# Development mode (auto-reload)
bun run dev

# Production mode
bun run start
```

You should see:

```
[MOD] Bot initialized. Address: 0x...
[MOD] Bot handlers registered successfully!
[MOD] Bot wallet address: 0x...
[MOD] Ready to receive commands and tips!
```

**✅ Bot is running!**

## 4. Fund the Bot Wallet

The bot needs ETH to pay for on-chain transactions.

**Bot Wallet Address:** Check console output for `0x...`

Send ~0.01 ETH to this address on **Base L2**.

**How to get Base ETH:**
- Bridge from Ethereum mainnet: https://bridge.base.org
- Use a faucet (testnet): https://www.coinbase.com/faucets/base-ethereum-gobi-faucet
- Buy directly on Base via exchange

## 5. Add Bot to Your Town

1. Go to your Town in the Towns app
2. Navigate to Settings → Integrations → Bots
3. Add your bot using the bot ID
4. Grant permissions:
   - ✅ Read Messages
   - ✅ Write Messages
   - ✅ Manage Roles (ModifyRoles)
   - ✅ Ban Members

## 6. Initial Setup in Town

Once bot is in your Town:

### Step 1: Fund Your Space Budget

In any channel, run:

```
/fund
```

Follow the instructions. **Recommended: Tip the bot**

```
/tip @ModBot 0.05
```

This allocates 0.05 ETH to your space's budget.

### Step 2: Create On-Chain Roles

```
/setup
```

This will:
- Create "Verified Member" role on Base blockchain
- Cost: ~0.00002 ETH
- Takes ~5-10 seconds

You should see:

```
✅ ModBot Setup Complete! 🎉

On-Chain Role Created:
🏷️ Name: Verified Member
🆔 Role ID: 1
📝 Transaction: 0xabcd...
💰 Cost: 0.000015 ETH
```

### Step 3: Configure Settings (Optional)

```
/settings
```

View current settings, then update as needed:

```
/settings profanityFilter true
/settings spamDetection true
/settings warnAfter 3
```

## 7. Test Verification Flow

### As Admin:
1. Create a test account or have a friend join
2. User joins any channel
3. Bot sends welcome message with ✅ reaction
4. User reacts with ✅
5. Bot assigns on-chain role (costs ~0.00001 ETH)
6. User is now verified! 🎉

### Verification Message:
```
👋 Welcome to the community, @user!

Please review our guidelines...

React with ✅ below to get verified and receive your on-chain role.

✨ Verified members receive:
• On-chain "Verified Member" role
• Full access to bot commands
• Recognition in the community
```

### Confirmation:
```
✅ @user is now a Verified Member! 🎉

You've been assigned the "Verified Member" role on-chain.
🔗 Transaction: 0xabcd...
💰 Cost: 0.00001 ETH

Welcome to the community!
```

## 8. Essential Commands

### Admin Commands

| Command | Description |
|---------|-------------|
| `/fund` | View funding options |
| `/budget status` | Check space balance |
| `/budget expenses` | View spending history |
| `/setup` | Initialize on-chain roles |
| `/settings` | Configure moderation |
| `/ban @user` | Ban user |
| `/warn @user` | Issue warning |
| `/infractions @user` | View user history |

### User Commands

| Command | Description |
|---------|-------------|
| `/mywarnings` | View your warnings |
| `/help` | Get help |

## 9. Monitor Bot Activity

### Check Budget:
```
/budget status
```

### View Recent Expenses:
```
/budget expenses 10
```

### View Expense Breakdown:
```
/budget breakdown
```

## Troubleshooting

### Bot not responding?
- Check console for errors
- Verify bot is running (`bun run dev`)
- Check webhook URL is correct
- Ensure bot has permissions in Town

### Setup fails?
```
❌ Insufficient budget
```
**Solution:** Fund your space with `/tip @ModBot <amount>`

### Role assignment fails?
```
⚠️ Verification completed (database only)
```
**Possible causes:**
- Insufficient budget → Add more funds
- Bot lacks ModifyRoles permission → Check bot permissions
- Network issues → Try again

### User not getting role?
**Checklist:**
1. Is setup complete? → `/budget status`
2. Is there budget? → Should show balance > 0
3. Did user react to welcome message? → Check reactions
4. Check bot logs → Look for errors

### Out of funds?
```
⚠️ Admin Alert: Space budget is running low!
```
**Solution:**
```
/tip @ModBot 0.05
```
Or:
```
/budget fund 0.05
```

## Database Management

### View database:
```bash
sqlite3 data/modbot.db

# List tables
.tables

# Query budget
SELECT * FROM towns;

# Query expenses
SELECT * FROM space_expenses ORDER BY timestamp DESC LIMIT 10;

# Exit
.quit
```

### Backup database:
```bash
cp data/modbot.db data/modbot-backup-$(date +%Y%m%d).db
```

## Advanced Configuration

### Set Budget Limit:
```
/budget limit 0.5
```
Prevents space from spending more than 0.5 ETH.

### Set Low Balance Alert:
```
/budget threshold 0.01
```
Alerts when balance drops below 0.01 ETH.

### Estimate Costs:
```
/budget estimate create_role
/budget estimate assign_role
```

## Production Deployment

### Using PM2:
```bash
# Install PM2
bun install -g pm2

# Start bot
pm2 start bun --name "modbot" -- run start

# View logs
pm2 logs modbot

# Restart
pm2 restart modbot

# Auto-start on boot
pm2 startup
pm2 save
```

### Using Docker:
```dockerfile
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .

CMD ["bun", "run", "start"]
```

```bash
docker build -t modbot .
docker run -d --name modbot -p 5123:5123 --env-file .env modbot
```

## Next Steps

- ✅ Read full documentation: `IMPLEMENTATION.md`
- ✅ Configure custom welcome messages
- ✅ Set up multiple Towns/Spaces
- ✅ Integrate with other bots
- ✅ Monitor expenses and optimize
- ✅ Set up automated backups

## Support

- **Logs:** Check console output
- **Database:** `sqlite3 data/modbot.db`
- **Transactions:** https://basescan.org
- **Docs:** `AGENTS.md`, `IMPLEMENTATION.md`
- **Towns:** https://docs.towns.com

## Cost Reference

| Operation | Est. Gas | Est. Cost (Base) |
|-----------|----------|------------------|
| Setup (create role) | ~200k | ~0.00002 ETH |
| Verify user (assign) | ~100k | ~0.00001 ETH |
| Per 100 users | ~10M | ~0.001 ETH |

**Recommended budget per space:** 0.05 ETH (covers ~5000 verifications)

## Success Checklist

- [x] Bot running locally
- [x] Bot funded with ETH
- [x] Bot added to Town
- [x] Permissions granted
- [x] Space funded via tip
- [x] Setup completed
- [x] Test user verified
- [x] Budget monitoring set up

**🎉 Congratulations! Your ModBot is fully operational!**

---

**Version:** 1.0.0  
**Need help?** Check `IMPLEMENTATION.md` for detailed documentation.