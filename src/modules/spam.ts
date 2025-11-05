import { getMember, addInfraction, incrementWarning } from "../db/index";

/**
 * Spam detection result
 */
export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
}

/**
 * User message tracking for rate limiting
 */
interface UserMessageTrack {
  messages: Array<{ content: string; timestamp: number; channelId: string }>;
  lastWarned: number;
}

// In-memory tracking of user messages for spam detection
const userMessageHistory = new Map<string, UserMessageTrack>();

// Spam detection thresholds
const SPAM_THRESHOLDS = {
  MAX_MESSAGES_PER_MINUTE: 5,
  MAX_IDENTICAL_MESSAGES: 3,
  MAX_CAPS_PERCENTAGE: 70,
  MIN_MESSAGE_LENGTH_FOR_CAPS_CHECK: 10,
  DUPLICATE_TIME_WINDOW: 30000, // 30 seconds
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  WARNING_COOLDOWN: 300000, // 5 minutes between warnings
};

/**
 * Detects if a message is spam based on various heuristics
 */
export function detectSpam(
  userId: string,
  message: string,
  channelId: string,
): SpamCheckResult {
  const now = Date.now();

  // Get or create user tracking
  let userTrack = userMessageHistory.get(userId);

  if (!userTrack) {
    userTrack = { messages: [], lastWarned: 0 };
    userMessageHistory.set(userId, userTrack);
    // Clean old messages outside the rate limit window
    userTrack.messages = userTrack.messages.filter(
      (msg) => now - msg.timestamp < SPAM_THRESHOLDS.RATE_LIMIT_WINDOW,
    );

    // 1. Check rate limiting (messages per minute)
    if (userTrack.messages.length >= SPAM_THRESHOLDS.MAX_MESSAGES_PER_MINUTE) {
      return {
        isSpam: true,
        reason: "Too many messages sent in a short time",
      };
    }
    // 2. Check for repeated identical messages
    const recentDuplicates = userTrack.messages.filter(
      (msg) =>
        msg.content.toLowerCase().trim() === message.toLowerCase().trim() &&
        now - msg.timestamp < SPAM_THRESHOLDS.DUPLICATE_TIME_WINDOW,
    );

    if (recentDuplicates.length >= SPAM_THRESHOLDS.MAX_IDENTICAL_MESSAGES) {
      return {
        isSpam: true,
        reason: "Repeated identical messages",
      };
    }
    // 3. Check for excessive caps (if message is long enough)
    if (message.length >= SPAM_THRESHOLDS.MIN_MESSAGE_LENGTH_FOR_CAPS_CHECK) {
      const capsCount = (message.match(/[A-Z]/g) || []).length;
      const letterCount = (message.match(/[a-zA-Z]/g) || []).length;
      if (letterCount > 0) {
        const capsPercentage = (capsCount / letterCount) * 100;
        if (capsPercentage >= SPAM_THRESHOLDS.MAX_CAPS_PERCENTAGE) {
          return {
            isSpam: true,
            reason: "Excessive use of capital letters",
          };
        }
      }
      // 4. Check for known spam patterns
      const spamPatterns = [
        /(.)\1{10,}/i, // Repeated character (11+ times)
        /https?:\/\/.*https?:\/\/.*https?:\/\//i, // Multiple URLs
        /@everyone.*@everyone/i, // Multiple @everyone mentions
        /\b(buy now|click here|limited time|act now)\b/i, // Common spam phrases
      ];

      for (const pattern of spamPatterns) {
        if (pattern.test(message)) {
          return {
            isSpam: true,
            reason: "Message matches known spam pattern",
          };
          // 5. Check for excessive emojis
          const emojiCount = (
            message.match(
              /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
            ) || []
          ).length;
          if (emojiCount > 15) {
            return {
              isSpam: true,
              reason: "Excessive emoji usage",
            };
            // Add message to history
            userTrack?.messages.push({
              content: message,
              timestamp: now,
              channelId,
            });

            return { isSpam: false };
          }
        }
      }
    }

    return { isSpam: false }
  }

  /**
   * Handles spam detection by recording infraction and incrementing warnings
   */
  export function handleSpamDetection(
    spaceId: string,
    userId: string,
    message: string,
    eventId: string,
  ) {
    // Record infraction
    addInfraction(spaceId, userId, {
      type: "spam",
      message: message.substring(0, 100), // Truncate long messages
      messageId: eventId,
      timestamp: Date.now(),
    });

    // Increment warning count
    incrementWarning(spaceId, userId);

    // Return updated member profile
    return getMember(spaceId, userId);
  }

  /**
   * Clears spam history for a user (useful after warnings reset)
   */
  export function clearSpamHistory(userId: string) {
    userMessageHistory.delete(userId);
  }

  /**
   * Gets spam statistics for a user
   */
  export function getUserSpamStats(userId: string) {
    const userTrack = userMessageHistory.get(userId);

    if (!userTrack) {
      return {
        recentMessages: 0,
        lastWarned: 0,
      };
    }
    const now = Date.now();
    const recentMessages = userTrack.messages.filter(
      (msg) => now - msg.timestamp < SPAM_THRESHOLDS.RATE_LIMIT_WINDOW,
    ).length;

    return {
      recentMessages,
      lastWarned: userTrack.lastWarned,
    };
  }

  /**
   * Cleanup function to periodically clear old tracking data
   * Should be called periodically (e.g., every 10 minutes)
   */
  export function cleanupSpamTracking() {
    const now = Date.now();
    const maxAge = SPAM_THRESHOLDS.RATE_LIMIT_WINDOW * 2; // Keep 2x the window

    for (const [userId, track] of userMessageHistory.entries()) {
      // Remove old messages
      track.messages = track.messages.filter(
        (msg) => now - msg.timestamp < maxAge,
      );

      // Remove user entirely if no recent activity
      if (track.messages.length === 0 && now - track.lastWarned > maxAge) {
        userMessageHistory.delete(userId);

        console.log(
          `[Spam] Cleanup complete. Tracking ${userMessageHistory.size} users.`,
        );
      }

      // Optional: Set up periodic cleanup (every 10 minutes)
      if (typeof setInterval !== "undefined") {
        setInterval(cleanupSpamTracking, 10 * 60 * 1000);
      }
    }
  }
}
