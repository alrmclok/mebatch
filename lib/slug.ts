import { randomInt } from "crypto";

const WORDS = ["happy","lime","cloud","tiny","brave","orange","sunny","mint","pixel","cozy","swift","panda",
  "river","lemon","amber","zesty","fuzzy","jolly","maple","otter","comet","daisy","ember","frost",
  "gummy","honey","ivory","jelly","koala","lucky","misty","noodle","olive","peach","quartz","rusty",
  "silver","tulip","umber","velvet","willow","yarn","zebra","berry","candy","dizzy","echo","fable"];
const CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i

export function makeSlug(format: "words" | "chars") {
  if (format === "chars")
    return Array.from({ length: 5 }, () => CHARS[randomInt(CHARS.length)]).join("");
  return Array.from({ length: 3 }, () => WORDS[randomInt(WORDS.length)]).join("-");
}