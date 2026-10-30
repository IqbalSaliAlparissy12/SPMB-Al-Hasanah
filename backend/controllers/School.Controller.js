import { listAmanahSchools } from "../services/amanahSchools.js";

export async function listSchools(_req, res) {
  try {
    const schools = await listAmanahSchools();
    return res.json({ schools });
  } catch (error) {
    return res.status(502).json({
      message: `Tidak dapat memuat lembaga dari Amanah: ${error.message}`,
      schools: [],
    });
  }
}

