export function publicUser(user) {
  return {
    uuid: user.uuid,
    name: user.name,
    wa: user.wa,
    username: user.username,
    role: user.role,
  };
}

export function serializeDashboard({ user, applicant, bill, documents }) {
  return {
    user: publicUser(user),
    applicant,
    bill,
    documents: documents || [],
  };
}
