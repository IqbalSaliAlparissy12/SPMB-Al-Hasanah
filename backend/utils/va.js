import { randomInt } from "crypto";

function randomDigits(length) {
  let digits = "";
  for (let i = 0; i < length; i += 1) digits += randomInt(0, 10);
  return digits;
}

export function generateVirtualAccounts(bniPrefix) {
  const tail = randomDigits(8);
  const prefix = String(bniPrefix || "98810000").replace(/\D/g, "") || "98810000";
  const filler = "0".repeat(Math.max(0, 16 - prefix.length - tail.length));
  return {
    vaBni: `${prefix}${filler}${tail}`.slice(0, 16),
    vaBca: `70012000${tail}`,
    vaMandiri: `88810000${tail}`,
  };
}
