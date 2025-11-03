import type { BotHandler } from "@towns-protocol/bot";
import { isAdmin } from "./permissions";

function getBotRichResponse(isAdmin: boolean) {
  const baseInfo = `
👋 **Hey there! I’m ModBot — your friendly town moderation assistant.**

Here’s what I can do for you:
- 🔍 **Auto-detect profanity** and keep chat clean.
- ⚠️ Track **user warnings** and label repeat offenders.
- 🏷️ Assign a **"needs-review"** tag once a user reaches the warning threshold.
- 🤖 Support moderation commands like \`/mod infractions\` and \`/mod settings\`.

---

💡 **For regular users:**
- You can see your warnings via \`/mod infractions\`.
- Avoid profanity or repeated rule-breaking to prevent warnings.
- If you believe you were flagged unfairly, please reach out to an admin.
`;

  const adminInfo = `
---

🛡️ **Admin / Moderator Tools:**
- 🧩 \`/mod mute-label <label>\` — Mass mute users with a specific label (e.g. "needs-review").
- ⚙️ \`/mod settings\` — Adjust moderation thresholds (e.g. warn limit, auto-warn behavior).
- 📋 \`/mod infractions <user>\` — See user infraction history.
- 🏠 Automatic setup — I’ll initialize moderation when added to a new town.
- 🚨 Easily review all flagged users via their labels.

💾 Data is stored locally in SQLite (Bun), ensuring persistence even across restarts.
`;

  const footer = `
---

✨ *Tip:* Mention me anytime for help or to see this guide again.
`;

  const content = baseInfo + (isAdmin ? adminInfo : "") + footer;

  return {
    embeds: [
      {
        title: "ModBot — Town Moderation Assistant",
        description: content,
        color: isAdmin ? 0x5b9bd5 : 0x9fa8da,
      },
    ],
  };
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
    await handler.sendMessage(channelId, JSON.stringify(response));
  } catch (err) {
    console.error("Error handling bot mention:", err);
    await handler.sendMessage(
      channelId,
      "⚠️ Sorry, I ran into an issue responding to your mention.",
    );
  }
}
