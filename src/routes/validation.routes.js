const express = require("express")
const router = express.Router()

const validationController = require("../controllers/validation.controller")
const { authMiddleware } = require("../middlewares/auth.middleware")
const { allowRoles } = require("../middlewares/role.middleware")

router.get(
  "/posts",
  authMiddleware,
  allowRoles("dosen"),
  validationController.getValidatablePosts
)

router.post(
  "/posts/:postId/validate",
  authMiddleware,
  allowRoles("dosen"),
  validationController.validatePost
)

module.exports = router
