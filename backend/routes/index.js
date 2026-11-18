import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import verifyJWT, { requireGuruOrTu, requireParent, requireStaff, requireTu } from "../middleware/verifyJWT.js";
import {
  login,
  logout,
  lookupAmanahParent,
  me,
  register,
  staffLogin,
  suggestAmanahStudents,
} from "../controllers/Auth.Controller.js";
import { listSchools } from "../controllers/School.Controller.js";
import {
  createClass,
  deleteClass,
  listAll as listSpmbClasses,
  listPublishedBySchool,
  updateClass,
} from "../controllers/SpmbClass.Controller.js";
import {
  createWave,
  deleteWave,
  listWaves,
  updateWave,
} from "../controllers/SpmbWave.Controller.js";
import {
  lookupNisn,
  setStep,
  simulateAnnouncement,
  updateForm,
  uploadPhoto,
} from "../controllers/Applicant.Controller.js";
import { bniNotify, checkBniStatus, selectMethod, simulatePay } from "../controllers/Bill.Controller.js";
import { checkAdmissionPayment, startAdmissionPayment } from "../controllers/AdmissionPayment.Controller.js";
import { finishRegistration, uploadDocument } from "../controllers/Document.Controller.js";
import { getStudentValidation, saveStudentValidation } from "../controllers/StudentValidation.Controller.js";
import {
  controlApplicant,
  getApplicantFeeDetails,
  getExamSchedule,
  listApplicants,
  listPublishedStages,
  listStages,
  updateStage,
  saveExamSchedule,
  saveApplicantFeeDetails,
  recordAdmissionPayment,
} from "../controllers/Tu.Controller.js";
import { pushMe, status as syncStatus } from "../controllers/Sync.Controller.js";
import {
  createRequirement,
  deleteRequirement,
  listAll,
  listPublished,
  updateRequirement,
} from "../controllers/Requirement.Controller.js";
import {
  createDocRequirement,
  deleteDocRequirement,
  listDocRequirements,
  listPublishedDocRequirements,
  updateDocRequirement,
} from "../controllers/DocRequirement.Controller.js";
import {
  createStatement,
  deleteStatement,
  listPublishedStatements,
  listStatements,
  updateStatement,
  uploadStatementFile,
} from "../controllers/Statement.Controller.js";
import {
  createSubject,
  deleteSubject,
  listExamCandidates,
  listSubjects,
  publishExamResults,
  saveExamResult,
  updateSubject,
} from "../controllers/Exam.Controller.js";
import {
  createFeeGroup,
  createFeeItem,
  createFeePackage,
  deleteFeeGroup,
  deleteFeeItem,
  deleteFeePackage,
  generateAnnualFeeSetup,
  getFeeSetup,
  publicRegistrationFee,
  saveAnnualFeeAmounts,
  updateFeeGroup,
  updateFeeItem,
  updateFeePackage,
} from "../controllers/FeeSetup.Controller.js";
import { getRegistrationPrefix, saveRegistrationPrefix } from "../controllers/SpmbSchoolConfig.Controller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = req.user?.uuid || req.staff?.uuid || "file";
    cb(null, `${id}-${Date.now()}${ext}`);
  },
});
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
});

function uploadFile(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Ukuran berkas maksimal 2 MB per dokumen." });
    }
    if (err) return res.status(400).json({ message: err.message || "Berkas tidak dapat diunggah." });
    next();
  });
}

const router = express.Router();

router.get("/schools", listSchools);
router.get("/schools/:schoolId/classes", listPublishedBySchool);
router.get("/schools/:schoolId/registration-fee", publicRegistrationFee);
router.get("/tu/fee-setup", verifyJWT, requireTu, getFeeSetup);
router.get("/tu/registration-prefix", verifyJWT, requireTu, getRegistrationPrefix);
router.put("/tu/registration-prefix", verifyJWT, requireTu, saveRegistrationPrefix);
router.post("/tu/fee-items", verifyJWT, requireTu, createFeeItem);
router.patch("/tu/fee-items/:id", verifyJWT, requireTu, updateFeeItem);
router.delete("/tu/fee-items/:id", verifyJWT, requireTu, deleteFeeItem);
router.post("/tu/fee-groups", verifyJWT, requireTu, createFeeGroup);
router.patch("/tu/fee-groups/:id", verifyJWT, requireTu, updateFeeGroup);
router.delete("/tu/fee-groups/:id", verifyJWT, requireTu, deleteFeeGroup);
router.post("/tu/fee-packages", verifyJWT, requireTu, createFeePackage);
router.patch("/tu/fee-packages/:id", verifyJWT, requireTu, updateFeePackage);
router.delete("/tu/fee-packages/:id", verifyJWT, requireTu, deleteFeePackage);
router.post("/tu/annual-fees/generate", verifyJWT, requireTu, generateAnnualFeeSetup);
router.put("/tu/annual-fees/:id", verifyJWT, requireTu, saveAnnualFeeAmounts);
router.get("/schools/:schoolId/stages", listPublishedStages);
router.get("/spmb-stages", verifyJWT, requireTu, listStages);
router.patch("/spmb-stages/:step", verifyJWT, requireTu, updateStage);
router.get("/tu/applicants", verifyJWT, requireTu, listApplicants);
router.get("/tu/applicants/:id/fee-details", verifyJWT, requireTu, getApplicantFeeDetails);
router.put("/tu/applicants/:id/fee-details", verifyJWT, requireTu, saveApplicantFeeDetails);
router.post("/tu/applicants/:id/admission-payments", verifyJWT, requireTu, recordAdmissionPayment);
router.patch("/tu/applicants/:id", verifyJWT, requireTu, controlApplicant);
router.get("/tu/exam-schedule", verifyJWT, requireTu, getExamSchedule);
router.put("/tu/exam-schedule", verifyJWT, requireTu, saveExamSchedule);
router.get("/spmb-classes", verifyJWT, requireStaff, listSpmbClasses);
router.post("/spmb-classes", verifyJWT, requireTu, createClass);
router.patch("/spmb-classes/:id", verifyJWT, requireTu, updateClass);
router.delete("/spmb-classes/:id", verifyJWT, requireTu, deleteClass);
router.get("/spmb-waves", verifyJWT, requireStaff, listWaves);
router.post("/spmb-waves", verifyJWT, requireTu, createWave);
router.patch("/spmb-waves/:id", verifyJWT, requireTu, updateWave);
router.delete("/spmb-waves/:id", verifyJWT, requireTu, deleteWave);
router.post("/auth/register", register);
router.get("/auth/amanah-student-suggestions", suggestAmanahStudents);
router.post("/auth/amanah-parent-lookup", lookupAmanahParent);
router.post("/auth/login", login);
router.post("/auth/staff-login", staffLogin);
router.post("/auth/logout", logout);

router.get("/me", verifyJWT, me);
router.patch("/applicants/me", verifyJWT, requireParent, updateForm);
router.post("/applicants/me/step", verifyJWT, requireParent, setStep);
router.post("/applicants/me/announcement", verifyJWT, requireParent, simulateAnnouncement);
router.post("/applicants/me/photo", verifyJWT, requireParent, uploadFile, uploadPhoto);
router.get("/applicants/lookup-nisn", verifyJWT, requireParent, lookupNisn);
router.get("/applicants/me/student-validation", verifyJWT, requireParent, getStudentValidation);
router.put("/applicants/me/student-validation", verifyJWT, requireParent, saveStudentValidation);

router.post("/bills/me/method", verifyJWT, requireParent, selectMethod);
router.post("/bills/me/simulate-pay", verifyJWT, requireParent, simulatePay);
router.post("/bills/me/bni-status", verifyJWT, requireParent, checkBniStatus);
router.post("/admission-payments/me", verifyJWT, requireParent, startAdmissionPayment);
router.post("/admission-payments/me/check", verifyJWT, requireParent, checkAdmissionPayment);
router.post("/bills/bni/notify", bniNotify);

router.get("/doc-requirements/published", listPublishedDocRequirements);
router.get("/doc-requirements", verifyJWT, requireStaff, listDocRequirements);
router.post("/doc-requirements", verifyJWT, requireTu, createDocRequirement);
router.patch("/doc-requirements/:id", verifyJWT, requireTu, updateDocRequirement);
router.delete("/doc-requirements/:id", verifyJWT, requireTu, deleteDocRequirement);

router.post("/documents", verifyJWT, requireParent, uploadFile, uploadDocument);
router.post("/documents/finish", verifyJWT, requireParent, finishRegistration);

router.get("/exam-results", verifyJWT, requireGuruOrTu, listExamCandidates);
router.post("/exam-results", verifyJWT, requireGuruOrTu, saveExamResult);
router.post("/exam-results/publish", verifyJWT, requireTu, publishExamResults);
router.get("/exam-subjects", verifyJWT, requireGuruOrTu, listSubjects);
router.post("/exam-subjects", verifyJWT, requireTu, createSubject);
router.patch("/exam-subjects/:id", verifyJWT, requireTu, updateSubject);
router.delete("/exam-subjects/:id", verifyJWT, requireTu, deleteSubject);

router.get("/statements/published", listPublishedStatements);
router.get("/statements", verifyJWT, requireStaff, listStatements);
router.post("/statements", verifyJWT, requireTu, createStatement);
router.patch("/statements/:id", verifyJWT, requireTu, updateStatement);
router.post("/statements/:id/file", verifyJWT, requireTu, uploadFile, uploadStatementFile);
router.delete("/statements/:id", verifyJWT, requireTu, deleteStatement);

router.get("/requirements/published", listPublished);
router.get("/requirements", verifyJWT, requireStaff, listAll);
router.post("/requirements", verifyJWT, requireTu, createRequirement);
router.patch("/requirements/:id", verifyJWT, requireTu, updateRequirement);
router.delete("/requirements/:id", verifyJWT, requireTu, deleteRequirement);

router.get("/sync/status", verifyJWT, syncStatus);
router.post("/sync/push-me", verifyJWT, requireParent, pushMe);

export default router;
