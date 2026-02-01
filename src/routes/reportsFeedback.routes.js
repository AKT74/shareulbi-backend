const express = require("express");
const router = express.Router();
const controller = require("../controllers/reportsFeedback.controller");

const { authMiddleware } = require("../middlewares/auth.middleware");
const { allowRoles } = require("../middlewares/role.middleware");

/* USER */
router.post("/", authMiddleware, controller.createReportFeedback);

/* ADMIN */
router.get("/", authMiddleware, allowRoles("admin"), controller.getAllReportsFeedbacks);
router.get("/:id", authMiddleware, allowRoles("admin"), controller.getReportFeedbackById);
router.put("/:id/status", authMiddleware, allowRoles("admin"), controller.updateReportStatus);

module.exports = router;
