import { Router } from "express";
import { authenticateJWT, requirePro } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  listKitItems,
  getKitItem,
  createKitItem,
  updateKitItem,
  archiveKitItem,
  listKitFiles,
  uploadKitFile,
  downloadKitFile,
  deleteKitFile,
} from "../controllers/kit.controller";

const router = Router();
const auth = [authenticateJWT, requirePro, requireRole("freelancer")];

router.get("/", auth, listKitItems);
router.post("/", auth, createKitItem);
router.get("/:id", auth, getKitItem);
router.patch("/:id", auth, updateKitItem);
router.delete("/:id/archive", auth, archiveKitItem);

router.get("/:id/files", auth, listKitFiles);
router.post("/:id/files", auth, uploadKitFile);
router.get("/:id/files/:fileId/download", auth, downloadKitFile);
router.delete("/:id/files/:fileId", auth, deleteKitFile);

export default router;
