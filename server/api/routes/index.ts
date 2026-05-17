import express from "express";
import { registerAdminRoutes } from "./admin.route";
import { registerApplicationRoutes } from "./applications.route";
import { registerAuthRoutes } from "./auth.route";
import { registerContactRoutes } from "./contact.route";
import { registerFileRoutes } from "./file.route";
import { registerJobRoutes } from "./job.route";
import { registerMessagingRoutes } from "./message.route";
import { registerProfileRoutes } from "./profile.route";
import { registerRatingsRoutes } from "./rating.route";
import referenceRouter from "./reference.route";
import bookingRouter from "./booking.route";
import teamRouter from "./team.route";

const router = express.Router();

router.use("/auth", registerAuthRoutes);
router.use("/api/admin", registerAdminRoutes);
router.use("/message", registerMessagingRoutes);
router.use("/profile", registerProfileRoutes);
router.use("/job", registerJobRoutes);
router.use("/application", registerApplicationRoutes);
router.use("/file", registerFileRoutes);
router.use("/rating", registerRatingsRoutes);
router.use("/contact", registerContactRoutes);
router.use("/references", referenceRouter);
router.use("/bookings", bookingRouter);
router.use("/team", teamRouter);

export default router;
