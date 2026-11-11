const TIME_DIFF_LIMIT = 480;

function keyByte(key, index) {
  const length = key.length;
  let at = (index % length) - 1;
  if (at < 0) at += length;
  return key[at];
}

function shift(input, key, direction) {
  const data = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const keyBuf = Buffer.from(key);
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 1) {
    const keychar = keyByte(keyBuf, i);
    out[i] = direction === "enc" ? (data[i] + keychar) % 128 : (data[i] - keychar + 256) % 128;
  }
  return out;
}

function doubleEncrypt(value, clientId, secret) {
  const mixed = shift(shift(Buffer.from(value, "utf8"), clientId, "enc"), secret, "enc");
  return mixed.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function doubleDecrypt(value, clientId, secret) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const raw = Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
  return shift(shift(raw, clientId, "dec"), secret, "dec").toString("utf8");
}

export function encryptPayload(data, clientId, secret) {
  const stamp = String(Math.floor(Date.now() / 1000)).split("").reverse().join("");
  return doubleEncrypt(`${stamp}.${JSON.stringify(data)}`, clientId, secret);
}

export function decryptPayload(value, clientId, secret) {
  const parsed = doubleDecrypt(String(value || ""), clientId, secret);
  const dot = parsed.indexOf(".");
  if (dot < 1) return null;
  const stamp = Number(parsed.slice(0, dot).split("").reverse().join(""));
  if (!Number.isFinite(stamp) || Math.abs(stamp - Date.now() / 1000) > TIME_DIFF_LIMIT) return null;
  try {
    return JSON.parse(parsed.slice(dot + 1));
  } catch {
    return null;
  }
}
