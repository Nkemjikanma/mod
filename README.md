# ModBot - Advanced Moderation Bot for Towns Protocol

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Towns Protocol](https://img.shields.io/badge/Towns-Protocol-purple.svg)

**The most advanced moderation bot for Towns with on-chain role management and per-space budget tracking.**

## 🌟 Features

### ✅ Automated Verification System
- **Welcome new members** with customizable messages
- **React-to-verify** mechanism with emoji acknowledgment
- **On-chain role assignment** for verified members
- **Blockchain-verified** permissions that work across apps

### 💰 Hybrid Budget Management
- **Per-space budget tracking** - Each Town has isolated budget
- **Multiple funding methods** - Tips, direct transfers, manual allocation
- **Real-time expense tracking** - Every gas fee recorded
- **Complete audit trail** - Full transaction history on-chain and in database
- **Spending limits** - Optional budget caps per space

### 🛡️ Advanced Moderation
- **Profanity filtering** with auto-deletion
- **Spam detection** (duplicate messages, rapid posting, excessive caps)
- **Warning system** with configurable thresholds
- **Auto-banning** after repeated violations
- **Label-based management** - Tag and manage users in bulk
- **Complete infraction history** per user

### 📊 Comprehensive Analytics
- **Budget status** - Real-time balance and spending
- **Expense breakdown** - View costs by operation type
- **Deposit history** - Track all funding sources
- **Operation estimates** - Know costs before executing

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your PRIVATE_DATA and JWT_SECRET

# Run the bot
bun run dev
```

**📖 Full setup guide:** See [QUICKSTART.md](QUICKSTART.md)

## 📋 Documentation

- **[Quick Start Guide](QUICKSTART.md)** - Get up and running in 5 minutes
- **[Implementation Guide](IMPLEMENTATION.md)** - Complete technical documentation
- **[Agent Documentation](AGENTS.md)** - Towns Protocol bot development guide

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                     ModBot                           │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │   Bot    │  │  Budget  │  │  Roles   │          │
│  │   Core   │  │  Manager │  │  (Web3)  │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │             │              │                 │
│  ┌────▼──────────────▼──────────────▼─────┐        │
│  │         Event Handlers                   │        │
│  │  • onChannelJoin  • onReaction          │        │
│  │  • onMessage      • onTip               │        │
│  │  • onSlashCommand                       │        │
│  └─────────────┬────────────────────────────┘        │
│                │                                      │
│  ┌─────────────▼────────────┐  ┌─────────────┐     │
│  │      SQLite Database     │  │    Base     │     │
│  │  • Budget Tracking       │  │  Blockchain │     │
│  │  • User Profiles         │  │  • Roles    │     │
│  │  • Infractions           │  │  • Txs      │     │
│  └──────────────────────────┘  └─────────────┘     │
│                                                       │
└─────────────────────────────────────────────────────┘
```

## 💡 How It Works

### Verification Flow

```
User Joins → Welcome Message → User Reacts ✅
    ↓              ↓                 ↓
Detected    Sent to channel    Verified status
    ↓              ↓                 ↓
Database    Emoji reaction     Role assigned
  record      button added      on-chain
    ↓              ↓                 ↓
Welcome     Awaiting user     Smart contract
 message      reaction          transaction
    ↓              ↓                 ↓
Stored      User clicks ✅    Blockchain
 in DB         emoji           confirmation
```

### Budget Flow

```
Admin Tips Bot → onTip Handler → Check Admin → Add to Space Budget
       ↓              ↓                ↓              ↓
  ETH sent     Event captured    Permission OK   Update balance
       ↓              ↓                ↓              ↓
   Base L2      Bot receives      Verified       Record deposit
Transaction     notification      admin          in database
```

### Role Assignment Flow

```
User Verified → Check Budget → Deduct Estimate → Execute Transaction
       ↓              ↓              ↓                   ↓
   Database     Sufficient?    Mark pending       Send to chain
    updated        funds            ↓                   ↓
       ↓              ↓         Expense ID         Wait for TX
   "verified"    Balance OK     recorded               ↓
    label            ↓              ↓            Confirmation
       ↓         Continue       Awaiting            received
   User gets       flow         completion             ↓
   verified          ↓              ↓            Update expense
    status      Blockchain     Record TX         with actual cost
       ↓         operation      in progress           ↓
    Access         starts           ↓            Adjust balance
    granted          ↓          Transaction       if needed
                  Role ID        on-chain             ↓
                  assigned          ↓            Complete ✅
```

## 🎯 Key Features Explained

### On-Chain Roles
- Roles created directly on Base blockchain
- Immutable and verifiable by anyone
- Works across any Towns-compatible app
- Permanent record of verification

### Per-Space Budgets
- Each Town has isolated budget
- No cross-space fund mixing
- Prevents budget draining
- Clear attribution of costs

### Multi-Funding Options
1. **Tips** (Recommended) - Automatic and instant
2. **Manual Allocation** - Admin control
3. **Direct Transfer** - Standard wallet send

### Complete Audit Trail
- Every transaction recorded
- Gas costs tracked precisely
- Who triggered each operation
- Full expense history

## 📦 Technologies

- **Runtime:** [Bun](https://bun.sh)
- **Language:** TypeScript
- **Framework:** [Hono](https://hono.dev) (HTTP server)
- **Blockchain:** [Viem](https://viem.sh) (Ethereum interactions)
- **Database:** SQLite (local, embedded)
- **Protocol:** [Towns Protocol](https://docs.towns.com) (Bot SDK)
- **Network:** Base L2 (low-cost Ethereum Layer 2)

## 🔧 Commands

### Admin Commands
| Command | Description | Cost |
|---------|-------------|------|
| `/setup` | Create on-chain roles | ~0.00002 ETH |
| `/fund` | View funding options | Free |
| `/budget` | Manage space budget | Free |
| `/ban @user` | Ban user | Free |
| `/warn @user` | Issue warning | Free |
| `/settings` | Configure bot | Free |
| `/infractions @user` | View history | Free |

### User Commands
| Command | Description | Requirements |
|---------|-------------|--------------|
| `/mywarnings` | View your warnings | Verified |
| `/help` | Get help | None |

### Budget Subcommands
```bash
/budget status          # View current budget
/budget fund <amount>   # Add funds manually
/budget expenses        # View expense history
/budget deposits        # View funding history
/budget limit <amount>  # Set spending cap
/budget threshold <amt> # Set low balance alert
/budget estimate <op>   # Estimate operation cost
/budget breakdown       # View costs by type
```

## 💸 Cost Estimates (Base L2)

| Operation | Gas Used | Est. Cost (0.1 gwei) |
|-----------|----------|---------------------|
| Create Role | ~200,000 | ~0.00002 ETH |
| Assign Role | ~100,000 | ~0.00001 ETH |
| Remove Role | ~80,000 | ~0.000008 ETH |
| Per 100 Users | ~10M | ~0.001 ETH |

**💡 Tip:** 0.05 ETH covers ~5000 user verifications!

## 🔐 Security

- ✅ **Budget Isolation** - Each space independent
- ✅ **Admin-Only Funding** - Only admins can add funds
- ✅ **Transaction Verification** - All txs verified on-chain
- ✅ **Permission Checks** - All commands verify permissions
- ✅ **Complete Audit Trail** - Every action logged
- ✅ **Database Labels** - Fallback if on-chain fails

## 📊 Database Schema

### Core Tables
- `towns` - Space configuration and budget
- `members` - User profiles and labels
- `infractions` - User violations
- `space_expenses` - Transaction costs
- `space_deposits` - Funding history
- `welcome_messages` - Verification tracking

**See [IMPLEMENTATION.md](IMPLEMENTATION.md) for full schema.**

## 🚦 Status Indicators

| Emoji | Meaning |
|-------|---------|
| ✅ | Completed/Success |
| ⚠️ | Warning/Low Balance |
| ❌ | Failed/Error |
| ⏳ | Processing/Pending |
| 💰 | Budget/Financial |
| 🔨 | Banned |
| 👢 | Kicked |

## 🧪 Testing

```bash
# Run type checking
bun run typecheck

# Run linter
bun run lint

# Fix lint issues
bun run lint:fix

# Build (check compilation)
bun run build
```

## 📈 Monitoring

### Bot Logs
```bash
# View real-time logs
bun run dev

# Production logs with PM2
pm2 logs modbot
```

### Database Queries
```bash
sqlite3 data/modbot.db

# View budgets
SELECT town_id, balance_wei, total_spent_wei FROM towns;

# View recent expenses
SELECT * FROM space_expenses ORDER BY timestamp DESC LIMIT 10;

# View deposits
SELECT * FROM space_deposits ORDER BY timestamp DESC LIMIT 10;
```

### On-Chain Verification
Check transactions on [BaseScan](https://basescan.org) using transaction hashes from bot output.

## 🐛 Troubleshooting

### Bot Not Responding
- Check bot is running: `bun run dev`
- Verify environment variables in `.env`
- Check bot permissions in Town
- Review console logs for errors

### Setup Fails
```
❌ Insufficient budget
```
**Fix:** Fund your space with `/tip @ModBot 0.05`

### Role Assignment Fails
```
⚠️ Verification completed (database only)
```
**Causes:**
- Low budget → Add funds
- Missing ModifyRoles permission → Check permissions
- Network issues → Retry

### Out of Budget
```
⚠️ Admin Alert: Space budget is running low!
```
**Fix:** `/tip @ModBot <amount>` or `/budget fund <amount>`

**See [QUICKSTART.md](QUICKSTART.md) for more troubleshooting.**

## 🛣️ Roadmap

- [ ] Multi-signature budget approvals
- [ ] Automated treasury refills
- [ ] Tiered verification roles (Silver/Gold/Platinum)
- [ ] Batch role assignments
- [ ] Gas optimization strategies
- [ ] Multi-chain support (Optimism, Arbitrum)
- [ ] DM notifications for budget alerts
- [ ] Analytics dashboard
- [ ] Role expiration/renewal
- [ ] DeFi integrations

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run `bun run lint` and `bun run typecheck`
6. Submit a pull request

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Towns Protocol](https://docs.towns.com) - Decentralized communication platform
- [Base](https://base.org) - Ethereum L2 network
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [Viem](https://viem.sh) - Ethereum library

## 📞 Support

- **Documentation:** [IMPLEMENTATION.md](IMPLEMENTATION.md)
- **Quick Start:** [QUICKSTART.md](QUICKSTART.md)
- **Bot Guide:** [AGENTS.md](AGENTS.md)
- **Towns Docs:** https://docs.towns.com
- **Issues:** GitHub Issues (if applicable)

## 📊 Stats

- **Lines of Code:** ~3000+
- **Commands:** 11
- **Features:** 15+
- **Database Tables:** 6
- **Supported Networks:** Base L2
- **Gas Efficiency:** Optimized for L2

---

**Built with ❤️ for the Towns Protocol community**

*Empowering communities with blockchain-verified moderation*

🌐 [Towns Protocol](https://towns.com) | 📖 [Documentation](https://docs.towns.com) | 🐦 [Twitter](https://twitter.com/TownsProtocol)