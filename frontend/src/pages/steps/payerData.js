const PARENT_FIELDS = {
  Ayah: {
    payerName: "fatherName",
    payerPhone: "fatherPhone",
    payerJob: "fatherJob",
    payerAddress: "fatherAddress",
  },
  Ibu: {
    payerName: "motherName",
    payerPhone: "motherPhone",
    payerJob: "motherJob",
    payerAddress: "motherAddress",
  },
};

export const PAYER_TYPES = Object.keys(PARENT_FIELDS);

export function updateValidationValue(values, key, value) {
  const next = { ...values, [key]: value };
  if (key === "payerType") {
    next.payerRelationship = value;
    for (const payerKey of Object.keys(PARENT_FIELDS.Ayah)) {
      const parentKey = PARENT_FIELDS[value]?.[payerKey];
      next[payerKey] = parentKey ? values[parentKey] || "" : "";
    }
  } else {
    const fields = PARENT_FIELDS[values.payerType];
    if (fields) {
      for (const [payerKey, parentKey] of Object.entries(fields)) {
        if (key === parentKey) next[payerKey] = value;
      }
    }
  }
  return next;
}
