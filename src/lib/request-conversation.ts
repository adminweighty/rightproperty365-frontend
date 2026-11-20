/**
 * Wording of the conversation on a property request (API 0.46.0), for the
 * agent's request page and the customer's. Pure, so `npm test` checks it
 * (scripts/request-conversation.test.mjs).
 */

export type ConversationSide = "professional" | "customer";

/** Who wrote a message, as the reader is shown it. The API already says "You" / "The agent" to the customer. */
export function authorLabel(message: { author_name: string; mine: boolean }, side: ConversationSide): string {
  if (message.mine) return "You";
  if (message.author_name) return message.author_name;
  return side === "customer" ? "The agent" : "The customer";
}

/** What an empty conversation says. */
export function emptyConversationText(side: ConversationSide): string {
  return side === "customer"
    ? "You’ll see the agent’s reply here."
    : "No messages yet. Your reply goes to the customer by email and in their account.";
}

/**
 * Why the reader cannot write, or null when they can. `closed` is the request's
 * state; `canReply` the API's answer.
 */
export function replyBlockedText(side: ConversationSide, { canReply, closed, messageCount }: { canReply: boolean; closed: boolean; messageCount: number }): string | null {
  if (canReply) return null;
  if (closed) return side === "customer" ? "This request is closed." : "This request is closed. Reopen it to reply.";
  if (side === "customer" && messageCount === 0) return null; // the empty text already says what happens next
  return side === "customer" ? "You can reply once the agent has written to you." : "You cannot reply to this request.";
}

/** The plain-language message for the API's conversation errors, or null for others. */
export function conversationErrorText(code: string, side: ConversationSide): string | null {
  switch (code) {
    case "REQUEST_CLOSED":
      return side === "customer" ? "This request has been closed, so it no longer takes replies." : "This request is closed. Reopen it to reply.";
    case "REPLY_NOT_OPEN":
      return "You can reply once the agent has written to you.";
    default:
      return null;
  }
}

/** The character counter under the composer. */
export function lengthHint(length: number, max: number): string {
  return `${length} of ${max} characters`;
}
