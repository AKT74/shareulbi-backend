const express = require("express")
const router = express.Router()

const categoriesController = require("../controllers/categories.controller")
const { authMiddleware } = require("../middlewares/auth.middleware")
const { allowRoles } = require("../middlewares/role.middleware")

router.get(
  "/",
  authMiddleware,
  categoriesController.getCategories
)

router.post(
  "/",
  authMiddleware,
  allowRoles("admin"),
  categoriesController.createCategory
)

router.put(
  "/:id",
  authMiddleware,
  allowRoles("admin"),
  categoriesController.updateCategory
)

router.delete(
  "/:id",
  authMiddleware,
  allowRoles("admin"),
  categoriesController.deleteCategory
)

module.exports = router
