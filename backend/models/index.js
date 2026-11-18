import db from "../config/database.js";
import User from "./User.js";
import Applicant from "./Applicant.js";
import Bill from "./Bill.js";
import Payment from "./Payment.js";
import DocumentFile from "./DocumentFile.js";
import SyncLog from "./SyncLog.js";
import Requirement from "./Requirement.js";
import Statement from "./Statement.js";
import DocRequirement from "./DocRequirement.js";
import SpmbClass from "./SpmbClass.js";
import SpmbStage from "./SpmbStage.js";
import SpmbWave from "./SpmbWave.js";
import ExamResult from "./ExamResult.js";
import ExamAnnouncement from "./ExamAnnouncement.js";
import ExamSubject from "./ExamSubject.js";
import ExamScore from "./ExamScore.js";
import ExamSchedule from "./ExamSchedule.js";
import FeeItem from "./FeeItem.js";
import FeeGroup from "./FeeGroup.js";
import FeeGroupItem from "./FeeGroupItem.js";
import FeePackage from "./FeePackage.js";
import AnnualFeeSetup from "./AnnualFeeSetup.js";
import AnnualFeeAmount from "./AnnualFeeAmount.js";
import ApplicantFeeAmount from "./ApplicantFeeAmount.js";
import AdmissionPayment from "./AdmissionPayment.js";
import SpmbSchoolConfig from "./SpmbSchoolConfig.js";
import StudentValidation from "./StudentValidation.js";

FeeGroup.hasMany(FeeGroupItem, { foreignKey: "groupId", as: "items" });
FeeGroupItem.belongsTo(FeeGroup, { foreignKey: "groupId" });
FeeItem.hasMany(FeeGroupItem, { foreignKey: "itemId", as: "groupLinks" });
FeeGroupItem.belongsTo(FeeItem, { foreignKey: "itemId" });
AnnualFeeSetup.hasMany(AnnualFeeAmount, { foreignKey: "setupId", as: "amounts" });
AnnualFeeAmount.belongsTo(AnnualFeeSetup, { foreignKey: "setupId" });
FeePackage.hasMany(AnnualFeeAmount, { foreignKey: "packageId", as: "annualAmounts" });
AnnualFeeAmount.belongsTo(FeePackage, { foreignKey: "packageId" });
FeeGroup.hasMany(AnnualFeeAmount, { foreignKey: "groupId", as: "annualAmounts" });
AnnualFeeAmount.belongsTo(FeeGroup, { foreignKey: "groupId" });

export {
  db,
  User,
  Applicant,
  Bill,
  Payment,
  DocumentFile,
  SyncLog,
  Requirement,
  Statement,
  DocRequirement,
  SpmbClass,
  SpmbStage,
  SpmbWave,
  ExamResult,
  ExamAnnouncement,
  ExamSubject,
  ExamScore,
  ExamSchedule,
  FeeItem,
  FeeGroup,
  FeeGroupItem,
  FeePackage,
  AnnualFeeSetup,
  AnnualFeeAmount,
  ApplicantFeeAmount,
  AdmissionPayment,
  SpmbSchoolConfig,
  StudentValidation,
};
