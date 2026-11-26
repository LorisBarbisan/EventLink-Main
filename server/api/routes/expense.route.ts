import type { Express } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  listCategories,
  createCategory,
  updateCategory,
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  archiveExpense,
  exportExpenses,
} from "../controllers/expense.controller";

export function registerExpenseRoutes(app: Express) {
  const auth = [authenticateJWT, requireRole("freelancer")];

  // Categories
  app.get("/api/expense-categories", ...auth, listCategories);
  app.post("/api/expense-categories", ...auth, createCategory);
  app.patch("/api/expense-categories/:id", ...auth, updateCategory);

  // Export must come before /:id to avoid matching "export" as an id
  app.get("/api/expenses/export", ...auth, exportExpenses);

  // Expenses
  app.get("/api/expenses", ...auth, listExpenses);
  app.post("/api/expenses", ...auth, createExpense);
  app.get("/api/expenses/:id", ...auth, getExpense);
  app.patch("/api/expenses/:id", ...auth, updateExpense);
  app.delete("/api/expenses/:id", ...auth, archiveExpense);
}
