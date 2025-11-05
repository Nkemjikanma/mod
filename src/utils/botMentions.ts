import type { BotHandler } from "@towns-protocol/bot";
import { isAdmin } from "./permissions";

function getBotRichResponse(isAdmin: boolean): string {
  const baseInfo = `👋 **Hey there! I'm ModBot — your friendly town moderation assistant.**

Here's what I can do for you:
- 🔍 **Auto-detect profanity** and keep chat clean
- 🚫 **Spam detection** to prevent message flooding
- ⚠️ Track **user warnings** and label repeat offenders
- 🏷️ Assign a **"needs-review"** tag once a user reaches the warning threshold
- 🤖 Support moderation commands

---

💡 **For regular users:**
- \`/mywarnings\` — See your warnings and infractions
- Avoid profanity, spam, or repeated rule-breaking to prevent warnings
- If you believe you were flagged unfairly, please reach out to an admin`;

  const adminInfo = `

---

🛡️ **Admin / Moderator Tools:**
- 🔨 \`/ban @user [reason]\` — Ban a user from the town
- ✅ \`/unban @user\` — Unban a previously banned user
- 👢 \`/kick @user [reason]\` — Remove user from all channels
- ⚠️ \`/warn @user [reason]\` — Manually warn a user
- 🧩 \`/mute-label <label>\` — Mass ban users with a specific label (e.g. "needs-review")
- ⚙️ \`/settings [key] [value]\` — Adjust moderation settings
- 📋 \`/infractions @user\` — See user infraction history
- 🏠 Automatic setup — I'll initialize moderation when added to a new town
- 🚨 Easily review all flagged users via their labels

**Available Settings:**
- \`profanityFilter\` (true/false) — Enable/disable profanity detection
- \`autoWarn\` (true/false) — Automatically warn users
- \`warnAfter\` (number) — Warnings before auto-labeling (default: 3)
- \`spamDetection\` (true/false) — Enable/disable spam detection

💾 Data is stored locally in SQLite (Bun), ensuring persistence even across restarts.`;

  const footer = `

---

✨ *Tip:* Mention me anytime for help or to see this guide again.`;

  return baseInfo + (isAdmin ? adminInfo : "") + footer;
}

export async function handleBotMention(
  handler: BotHandler,
  message: string,
  spaceId: string,
  userId: string,
  channelId: string,
  eventId?: string,
) {
  try {
    const admin = await isAdmin(handler, spaceId, userId);
    const response = getBotRichResponse(admin);
    await handler.sendMessage(channelId, response);
  } catch (err) {
    console.error("Error handling bot mention:", err);
    await handler.sendMessage(
      channelId,
      "⚠️ Sorry, I ran into an issue responding to your mention.",
    );
  }
}
