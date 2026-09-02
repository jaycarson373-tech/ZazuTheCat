export const BOT_PROJECT = "shiesty-pfp-bot";
export const OPT_IN_PHRASE = "shiesty me";
export const OPT_OUT_PHRASE = "stop";

/**
 * This prompt is deliberately code-owned, not environment-configurable. User posts
 * and profile metadata are never interpolated into it.
 */
export const SHIESTY_EDIT_PROMPT = [
  "Edit the supplied profile picture into a playful, nonviolent profile picture.",
  "Preserve the same person, animal, or object identity, facial features, expression, pose, crop, lighting, rendering style, and background.",
  "Add one clean black fabric balaclava as a harmless fashion accessory, fitted naturally around the existing head, with eye and mouth openings aligned correctly.",
  "Keep the original subject recognizable and keep the original background unchanged.",
  "Do not add weapons, threats, gore, injuries, crime, drugs, gang symbols, money, text, logos, watermarks, extra people, or extra objects.",
  "Do not change the subject's age, skin tone, species, body, hairstyle, clothing other than the balaclava, or camera angle.",
  "Return one polished square profile image."
].join(" ");

export const REPLY_TEXT = "Shiesty fitted. 🥷";
export const USER_AGENT = "shiesty-x-pfp-bot/1.0.0";

export const PROFILE_IMAGE_HOSTS = new Set(["pbs.twimg.com", "abs.twimg.com"]);
export const INPUT_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const OUTPUT_IMAGE_MIME_TYPE = "image/png";
export const X_IMAGE_MAX_BYTES = 5_000_000;
