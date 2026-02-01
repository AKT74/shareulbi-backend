const express = require("express");
const router = express.Router();
const controller = require("../controllers/feedbackTopic.controller");

const { authMiddleware } = require("../middlewares/auth.middleware");
const { allowRoles } = require("../middlewares/role.middleware");

// 🔓 SEMUA USER LOGIN BOLEH GET
router.get(
  "/",
  authMiddleware,
  controller.getTopics
);

// 🔒 ADMIN ONLY
router.post(
  "/",
  authMiddleware,
  allowRoles("admin"),
  controller.createTopic
);

router.put(
  "/:id",
  authMiddleware,
  allowRoles("admin"),
  controller.updateTopic
);

router.delete(
  "/:id",
  authMiddleware,
  allowRoles("admin"),
  controller.deleteTopic
);

module.exports = router;
