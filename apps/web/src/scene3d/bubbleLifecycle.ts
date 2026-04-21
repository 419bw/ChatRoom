import type { ChatMessage } from "@chat/protocol";

export type BubblePhase = "entering" | "visible" | "leaving";

export type ActorBubbleState = {
  id: string;
  text: string;
  phase: BubblePhase;
};

export const BUBBLE_VISIBLE_MS = 2800;
export const BUBBLE_EXIT_MS = 200;

export const createEnteringBubble = (
  message: Pick<ChatMessage, "id" | "text">,
): ActorBubbleState => ({
  id: message.id,
  text: message.text,
  phase: "entering",
});

export const markBubbleVisible = (
  bubble: ActorBubbleState,
): ActorBubbleState => ({
  ...bubble,
  phase: "visible",
});

export const markBubbleLeaving = (
  bubble: ActorBubbleState,
): ActorBubbleState => ({
  ...bubble,
  phase: "leaving",
});
