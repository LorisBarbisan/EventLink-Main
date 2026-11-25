import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  listKitItems,
  getKitItem,
  createKitItem,
  updateKitItem,
  archiveKitItem,
  recordKitExpense,
  dismissKitExpensePrompt,
  recordKitDisposal,
  dismissKitDisposalPrompt,
  listKitFiles,
  uploadKitFile,
  downloadKitFile,
  deleteKitFile,
} from "../controllers/kit.controller";

const router = Router();
const auth = [authenticateJWT, requireRole("freelancer")];

router.get("/", auth, listKitItems);
router.post("/", auth, createKitItem);
router.get("/:id", auth, getKitItem);
router.patch("/:id", auth, updateKitItem);
router.delete("/:id/archive", auth, archiveKitItem);
router.post("/:id/record-expense", auth, recordKitExpense);
router.post("/:id/dismiss-expense-prompt", auth, dismissKitExpensePrompt);
router.post("/:id/record-disposal", auth, recordKitDisposal);
router.post("/:id/dismiss-disposal-prompt", auth, dismissKitDisposalPrompt);

router.get("/:id/files", auth, listKitFiles);
router.post("/:id/files", auth, uploadKitFile);
router.get("/:id/files/:fileId/download", auth, downloadKitFile);
router.delete("/:id/files/:fileId", auth, deleteKitFile);

export default router;
