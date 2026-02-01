const express = require("express");
const router = express.Router();

const postsController = require("../controllers/posts.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { isOwnerOrAdmin } = require("../middlewares/postOwnership.middleware");
const { optionalAuth } = require("../middlewares/optionalAuth.middleware");

// =======================
// PUBLIC (OPTIONAL AUTH)
// =======================
router.get("/", authMiddleware, postsController.getPosts);
router.get(
  "/:id",
  authMiddleware,   // ⬅️ WAJIB
  postsController.getPostById
)
// =======================
// CREATE POST
// =======================
router.post(
  "/",
  authMiddleware,
  postsController.createPost
);

// =======================
// UPDATE POST
// =======================
router.put(
  "/:id",
  authMiddleware,
  isOwnerOrAdmin,
  postsController.updatePost
);

// =======================
// DELETE POST
// =======================
router.delete(
  "/:id",
  authMiddleware,
  isOwnerOrAdmin,
  postsController.deletePost
);

module.exports = router;
