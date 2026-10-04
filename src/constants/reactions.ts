/** Les reactions possibles sur un message : la meme liste fermee que l'API. */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
