// The wording of the conversation on a property request (API 0.46.0). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authorLabel,
  conversationErrorText,
  emptyConversationText,
  lengthHint,
  replyBlockedText,
} from "../src/lib/request-conversation.ts";

test("authors: the reader's own messages are 'You'; the API's names are kept", () => {
  assert.equal(authorLabel({ author_name: "Tendai Ncube", mine: true }, "professional"), "You");
  assert.equal(authorLabel({ author_name: "Rudo Moyo", mine: false }, "professional"), "Rudo Moyo");
  assert.equal(authorLabel({ author_name: "The seller", mine: false }, "customer"), "The seller");
  assert.equal(authorLabel({ author_name: "", mine: false }, "customer"), "The agent");
  assert.equal(authorLabel({ author_name: "", mine: false }, "professional"), "The customer");
});

test("an empty conversation says what happens next", () => {
  assert.match(emptyConversationText("customer"), /agent’s reply here/);
  assert.match(emptyConversationText("professional"), /by email and in their account/);
});

test("why the reader cannot write", () => {
  assert.equal(replyBlockedText("professional", { canReply: true, closed: false, messageCount: 0 }), null);
  assert.equal(replyBlockedText("professional", { canReply: false, closed: true, messageCount: 2 }), "This request is closed. Reopen it to reply.");
  assert.equal(replyBlockedText("customer", { canReply: false, closed: true, messageCount: 2 }), "This request is closed.");
  // Before the agent writes, the empty text is enough.
  assert.equal(replyBlockedText("customer", { canReply: false, closed: false, messageCount: 0 }), null);
});

test("the API's conversation errors in plain language", () => {
  assert.match(conversationErrorText("REQUEST_CLOSED", "professional"), /Reopen it/);
  assert.match(conversationErrorText("REQUEST_CLOSED", "customer"), /no longer takes replies/);
  assert.match(conversationErrorText("REPLY_NOT_OPEN", "customer"), /once the agent has written/);
  assert.equal(conversationErrorText("VALIDATION_FAILED", "customer"), null);
});

test("the counter", () => {
  assert.equal(lengthHint(12, 2000), "12 of 2000 characters");
});
