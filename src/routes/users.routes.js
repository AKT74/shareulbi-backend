const express = require("express")
const router = express.Router()

const usersController = require("../controllers/users.controller")
const { authMiddleware } = require("../middlewares/auth.middleware")
const { allowRoles } = require("../middlewares/role.middleware")
const activityLogsController = require("../controllers/activityLogs.controller")

// ======================
// ADMIN - ACTIVITY LOG
// ======================
router.get(
  "/activity-logs",
  authMiddleware,
  allowRoles("admin"),
  activityLogsController.getActivityLogs
)

// GET & UPDATE profil sendiri
router.get(
  "/me",
  authMiddleware,
  usersController.getMyProfile
)

router.put(
  "/me",
  authMiddleware,
  usersController.updateMyProfile
)


// ADMIN
router.get(
  "/",
  authMiddleware,
  allowRoles("admin"),
  usersController.getUsers
)

// GET user by id (admin)
router.get(
  "/:id",
  authMiddleware,
  allowRoles("admin"),
  usersController.getUserById
)
// UPDATE user by id (admin)

router.put(
  "/:id",
  authMiddleware,
  allowRoles("admin"),
  usersController.updateUserByAdmin
)



module.exports = router
