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
    await handler.sendMessage(
      channelId,
      `Current Settings:\n\`\`\`json\n${JSON.stringify(town.settings, null, 2)}\n\`\`\``,
    );
    return;
  }

  const [key, value] = args;
  const allowedKeys: (keyof TownSettings)[] = [
    "profanityFilter",
    "autoWarn",
    "warnAfter",
  ];

  if (!allowedKeys.includes(key as keyof TownSettings)) {
    await handler.sendMessage(channelId, `Unknown setting: ${key}`);
    return;
  }

  const typedKey = key as keyof TownSettings;

  // Convert value to boolean/number
  const newValue: boolean | number =
    value === "true" ? true : value === "false" ? false : parseInt(value);

  // Update DB
  updateTownSetting(spaceId, typedKey, newValue);

  await handler.sendMessage(
    channelId,
    `✅ Updated setting "${typedKey}" → ${newValue}`,
  );
}
