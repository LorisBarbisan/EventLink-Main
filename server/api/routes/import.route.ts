import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  uploadImport,
  listImports,
  getImport,
  enqueueImportParse,
  deleteImport,
} from "../controllers/import.controller";

const router = Router();

router.use(authenticateJWT);
router.use(requireRole("freelancer"));

router.post("/", uploadImport);
router.get("/", listImports);
router.get("/:id", getImport);
router.post("/:id/parse", enqueueImportParse);
router.delete("/:id", deleteImport);

export default router;
