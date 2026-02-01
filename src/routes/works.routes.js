// routes/works.routes.js
const express = require("express")
const { createWorks } = require("../controllers/works.controller")
const upload = require("../middlewares/upload.middleware");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { getWorksList } = require("../controllers/works.controller");
const router = express.Router()

router.post("/", authMiddleware, upload.single("file"), createWorks)
router.get("/", authMiddleware,getWorksList) // 👈 INI


module.exports = router
