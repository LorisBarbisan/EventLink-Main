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
import {
  lookupImportMapping,
  saveImportMapping,
  patchImportBatch,
} from "../controllers/import-mapping.controller";
import {
  listImportRows,
  setRowDecision,
  bulkSetDecision,
} from "../controllers/import-review.controller";

const router = Router();

router.use(authenticateJWT);
router.use(requireRole("freelancer"));

router.post("/", uploadImport);
router.get("/", listImports);
router.get("/:id", getImport);
router.patch("/:id", patchImportBatch);
router.post("/:id/parse", enqueueImportParse);
router.delete("/:id", deleteImport);

// Column mapping
router.post("/:id/mappings/lookup", lookupImportMapping);
router.post("/:id/mappings", saveImportMapping);

// Row review
router.get("/:id/rows", listImportRows);
router.post("/:id/rows/bulk", bulkSetDecision);
router.patch("/:id/rows/:rowId", setRowDecision);

export default router;
