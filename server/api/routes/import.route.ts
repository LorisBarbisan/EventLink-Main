import { Router } from "express";
import { expensiveWorkLimiter } from "../middleware/expensive-limit.middleware";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { requireUkFreelancer } from "../middleware/uk-freelancer.middleware";
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
import {
  commitImport,
  rollbackImport,
  importImpactHandler,
} from "../controllers/import-commit.controller";

const router = Router();

router.use(authenticateJWT);
router.use(requireRole("freelancer"));
router.use(requireUkFreelancer);

router.post("/", expensiveWorkLimiter, uploadImport);
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

// Commit / rollback
router.post("/:id/commit", expensiveWorkLimiter, commitImport);
router.post("/:id/rollback", rollbackImport);
router.get("/:id/impact", importImpactHandler);

export default router;
