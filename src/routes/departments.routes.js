const express = require("express")
const router = express.Router()

const departmentsController = require("../controllers/departments.controller")
const { authMiddleware } = require("../middlewares/auth.middleware")
const { allowRoles } = require("../middlewares/role.middleware")

router.get(
  "/", departmentsController.getDepartments
)

router.post(
  "/",
  authMiddleware,
  allowRoles("admin"),
  departmentsController.createDepartment
)

router.put(
  "/:id",
  authMiddleware,
  allowRoles("admin"),
  departmentsController.updateDepartment
)

router.delete(
  "/:id",
  authMiddleware,
  allowRoles("admin"),
  departmentsController.deleteDepartment
)

module.exports = router
