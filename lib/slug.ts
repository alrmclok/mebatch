import { randomInt } from "crypto";

const WORDS = ["apple", "bread", "stick", "stone", "torch", "sword", "arrow", "water", "paper", "brick",
  "glass", "sugar", "dirt", "coal", "iron", "gold", "wool", "book", "anvil", "bow",
  "chest", "boat", "bed", "door", "map", "bone", "slime", "flint", "clay", "egg",
  "kelp", "seed", "wheat", "rail", "sign", "lead", "bell", "clock", "compass", "chain",
  "cake", "cookie", "steak", "pork", "fish", "melon", "tnt", "bucket"];
const CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i

export function makeSlug(format: "words" | "chars") {
  if (format === "chars")
    return Array.from({ length: 5 }, () => CHARS[randomInt(CHARS.length)]).join("");
  return Array.from({ length: 3 }, () => WORDS[randomInt(WORDS.length)]).join("-");
}