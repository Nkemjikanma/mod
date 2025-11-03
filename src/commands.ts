import type { PlainMessage, SlashCommand } from "@towns-protocol/proto";

const commands = [
  {
    name: "help",
    description: "Get help with bot commands",
  },
  { name: "mute-label", description: "Mute all users with a given label" },
  { name: "settings", description: "View or update moderation settings" },
  { name: "infractions", description: "View user infractions" },
] as const satisfies PlainMessage<SlashCommand>[];

export default commands;
