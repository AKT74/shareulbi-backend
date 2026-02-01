const express = require("express")
const router = express.Router()

const { authMiddleware } = require("../middlewares/auth.middleware")
const bookmarksController = require("../controllers/bookmarks.controller")

router.post(
  "/posts/:postId/bookmark",
  authMiddleware,
  bookmarksController.toggleBookmark
)

router.get(
  "/bookmarks",
  authMiddleware,
  bookmarksController.getMyBookmarks
)

module.exports = router
