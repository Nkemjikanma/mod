import type { BotHandler } from "@towns-protocol/bot";
import {
  SpaceDapp,
  Permission,
  SpaceAddressFromSpaceId,
  type SendTipMemberParams,
  TipRecipientType,
  ETH_ADDRESS,
} from "@towns-protocol/web3";
export async function isAdmin(
  handler: BotHandler,
  spaceId: string,
  userId: string,
): Promise<boolean> {
  const adminStatus =
    (await handler.hasAdminPermission(spaceId, userId)) ||
    (await handler.checkPermission(spaceId, userId, "ModifySpaceSettings"));

  return adminStatus;
}
