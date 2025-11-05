import type { PlainMessage, SlashCommand } from "@towns-protocol/proto";

const commands = [
  { name: "help", description: "Get help with bot commands" },
  { name: "setup", description: "Set up on-chain verification roles (Admin only)" },
  { name: "fund", description: "View funding options for this space" },
  { name: "budget", description: "Manage space budget and view expenses (Admin only)" },
  { name: "ban", description: "Ban a user from the town (Admin only)" },
  { name: "unban", description: "Unban a user from the town (Admin only)" },
  { name: "kick", description: "Kick a user from all channels (Admin only)" },
  { name: "warn", description: "Manually warn a user (Admin only)" },
  { name: "mute-label", description: "Mute all users with a given label (Admin only)" },
  { name: "settings", description: "View or update moderation settings (Admin only)" },
  { name: "infractions", description: "View user infractions (Admin only)" },
  { name: "mywarnings", description: "View your own warnings and infractions" },
] as const satisfies PlainMessage<SlashCommand>[];

export default commands;
