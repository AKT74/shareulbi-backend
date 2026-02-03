const express = require("express")
const router = express.Router()

const adminController = require("../controllers/admin.controller")
const { authMiddleware } = require("../middlewares/auth.middleware")
const { allowRoles } = require("../middlewares/role.middleware")


// semua route admin → wajib login & admin
router.use(authMiddleware, allowRoles("admin"))

router.get("/users/pending", adminController.getPendingUsers)
router.patch("/users/:id/approve", adminController.approveUser)
router.patch("/users/:id/reject", adminController.rejectUser)
router.get("/users/pending/count", adminController.getPendingUserCount)

module.exports = router
