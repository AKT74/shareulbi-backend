const express = require("express");
const router = express.Router();

const upload = require("../middlewares/upload.middleware");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { createELearning } = require("../controllers/elearning.controller");
const { getELearningList } = require("../controllers/elearning.controller");


router.post(
    "/",
    authMiddleware,
    upload.single("file"),
    createELearning
);

router.get(
    "/",
    authMiddleware,
    getELearningList
);

module.exports = router;

