function pad(id) {
  return String(id).padStart(6, "0");
}

export function generateVirtualAccounts(userId) {
  const tail = `${Date.now().toString().slice(-8)}${pad(userId)}`;
  return {
    vaBni: `9881${tail}`.slice(0, 16),
    vaBca: `70012${tail}`.slice(0, 16),
    vaMandiri: `88810${tail}`.slice(0, 16),
  };
}

export function generateExamNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PPDB-${year}-${rand}`;
}
