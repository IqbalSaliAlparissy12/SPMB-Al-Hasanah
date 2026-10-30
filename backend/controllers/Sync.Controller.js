import { Applicant } from "../models/index.js";
import { amanahStatus, tryPushIfAccepted } from "../services/amanahSync.js";

export async function status(_req, res) {
  return res.json(amanahStatus());
}

export async function pushMe(req, res) {
  try {
    const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
    const result = await tryPushIfAccepted(applicant, req.user);
    const http = result.ok ? 200 : result.code === "DISABLED" ? 503 : 400;
    return res.status(http).json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
