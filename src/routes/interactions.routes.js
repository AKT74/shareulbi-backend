const express = require("express")
const router = express.Router()

const { authMiddleware } = require("../middlewares/auth.middleware")
const interactionsController = require("../controllers/interactions.controller")

router.post(
  "/posts/:postId/like",
  authMiddleware,
  interactionsController.toggleLike
)

router.post(
  "/posts/:postId/comments",
  authMiddleware,
  interactionsController.addComment
)

router.get(
  "/posts/:postId/comments",
  interactionsController.getComments
)

router.get(
  "/posts/:postId/interactions",
  authMiddleware,
  interactionsController.getInteractionSummary
)

module.exports = router
