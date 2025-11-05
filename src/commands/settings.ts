import { BotHandler } from "@towns-protocol/bot";
import { getTown, updateTownSetting } from "../db/index";
import { TownSettings } from "../types";
import { isAdmin } from "../utils/permissions";

export async function handleSettings(
  handler: BotHandler,
  {
    channelId,
    args,
    spaceId,
    userId,
  }: {
    channelId: string;
    args: string[];
    spaceId: string;
    userId: string;
  },
) {
  // Only admins can modify settings
  if (!(await isAdmin(handler, spaceId, userId))) {
    await handler.sendMessage(
      channelId,
      "⛔ Only admins can view or modify settings.",
      { ephemeral: true },
    );
    return;
  }

  const town = getTown(spaceId);

  // No args → show current settings
  if (args.length === 0) {
    const settingsText = `**Current Moderation Settings:**

\`\`\`json
${JSON.stringify(town.settings, null, 2)}
\`\`\`

**Usage:** \`/settings <key> <value>\`

**Available keys:**
- \`profanityFilter\` (true/false)
- \`autoWarn\` (true/false)
- \`warnAfter\` (number)
- \`spamDetection\` (true/false)`;

    await handler.sendMessage(channelId, settingsText);
    return;
  }

  const [key, value] = args;
  const allowedKeys: (keyof TownSettings)[] = [
    "profanityFilter",
    "autoWarn",
    "warnAfter",
    "spamDetection",
  ];

  if (!allowedKeys.includes(key as keyof TownSettings)) {
    await handler.sendMessage(channelId, `❌ Unknown setting: ${key}`);
    return;
  }

  const typedKey = key as keyof TownSettings;

  // Convert value to boolean/number
  let newValue: boolean | number;
  if (value === "true") newValue = true;
  else if (value === "false") newValue = false;
  else if (!isNaN(parseInt(value))) newValue = parseInt(value);
  else {
    await handler.sendMessage(channelId, `❌ Invalid value: ${value}`);
    return;
  }

  // Update DB
  updateTownSetting(spaceId, typedKey, newValue);

  await handler.sendMessage(
    channelId,
    `✅ Updated setting **${typedKey}** → \`${newValue}\``,
  )
}
