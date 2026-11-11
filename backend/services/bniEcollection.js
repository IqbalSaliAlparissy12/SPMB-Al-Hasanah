import { decryptPayload, encryptPayload } from "./bniEnc.js";

export function bniConfig() {
  return {
    clientId: String(process.env.BNI_VA_CLIENT_ID || "").trim(),
    secret: String(process.env.BNI_VA_SECRET || "").trim(),
    prefix: String(process.env.BNI_VA_PREFIX || "").trim(),
    apiUrl: String(process.env.BNI_VA_API_URL || "").trim(),
  };
}

export function bniEnabled() {
  const config = bniConfig();
  return Boolean(config.clientId && config.secret && config.prefix && config.apiUrl);
}

function jakartaExpiry(date) {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+07:00`;
}

async function callBni(payload) {
  const { clientId, secret, apiUrl } = bniConfig();
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      data: encryptPayload({ ...payload, client_id: clientId }, clientId, secret),
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (body.status !== "000") {
    throw new Error(body.message || `BNI menolak permintaan (${body.status || response.status}).`);
  }
  if (typeof body.data === "string") {
    const data = decryptPayload(body.data, clientId, secret);
    if (!data) throw new Error("Jawaban BNI tidak dapat dibaca.");
    return data;
  }
  return body.data || {};
}

export async function createCloseBilling({
  trxId,
  amount,
  customerName,
  customerPhone,
  virtualAccount,
  expiresAt,
  description = "Biaya pendaftaran SPMB",
}) {
  const { prefix } = bniConfig();
  return callBni({
    type: "createbilling",
    trx_id: trxId,
    trx_amount: String(amount),
    billing_type: "c",
    customer_name: String(customerName || "").slice(0, 100),
    customer_email: "",
    customer_phone: String(customerPhone || ""),
    virtual_account: virtualAccount,
    datetime_expired: jakartaExpiry(expiresAt),
    description,
    prefix,
  });
}

export async function inquireBilling(trxId) {
  return callBni({
    type: "inquirybilling",
    trx_id: trxId,
  });
}

export function decryptNotification(data) {
  const { clientId, secret } = bniConfig();
  return decryptPayload(data, clientId, secret);
}
