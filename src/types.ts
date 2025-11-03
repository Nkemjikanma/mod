export type Infraction = {
  id?: number;
  type: string;
  message: string;
  messageId: string;
  timestamp: number;
};

export type MemberProfile = {
  userId: string;
  infractions: Infraction[];
  labels: string[];
  warnings: number;
};

export type TownSettings = {
  profanityFilter: boolean;
  autoWarn: boolean;
  warnAfter: number;
};

export type TownProfile = {
  townId: string;
  settings: TownSettings;
  members: Record<string, MemberProfile>;
};

export interface CommandContext {
  spaceId: string;
  channelId: string;
  userId: string;
  args: string[];
  mentions?: { userId: string; username?: string }[];
  replyId?: string;
}

export type CommandHandler = (
  handler: any, // BotHandler from @towns-protocol/bot
  context: CommandContext,
) => Promise<void>;

export interface BotCommand {
  name: string;
  description: string;
  handler: CommandHandler;
}
