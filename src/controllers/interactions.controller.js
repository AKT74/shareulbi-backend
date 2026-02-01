const pool = require("../db")
const { logActivity } = require("../helpers/activity-log.helper")

/**
 * POST /posts/:postId/like
 * Toggle like
 */
exports.toggleLike = async (req, res) => {
  const userId = req.user.id
  const { postId } = req.params

  try {
    const check = await pool.query(
      `
      SELECT id FROM interactions
      WHERE user_id = $1 AND post_id = $2 AND type = 'like'
      `,
      [userId, postId]
    )

    if (check.rowCount > 0) {
      await pool.query(
        `DELETE FROM interactions WHERE id = $1`,
        [check.rows[0].id]
      )

      await logActivity(userId, "UNLIKE_POST", `Unlike post ${postId}`)
      return res.json({ message: "Post unliked" })
    }

    await pool.query(
      `
      INSERT INTO interactions (user_id, post_id, type)
      VALUES ($1, $2, 'like')
      `,
      [userId, postId]
    )

    await logActivity(userId, "LIKE_POST", `Like post ${postId}`)
    res.json({ message: "Post liked" })
  } catch (err) {
    console.error("ERROR TOGGLE LIKE:", err)
    res.status(500).json({ message: "Failed to toggle like" })
  }
}

/**
 * POST /posts/:postId/comments
 */
exports.addComment = async (req, res) => {
  const userId = req.user.id
  const { postId } = req.params
  const { content } = req.body

  if (!content) {
    return res.status(400).json({ message: "Comment content required" })
  }

  try {
    await pool.query(
      `
      INSERT INTO interactions (user_id, post_id, type, content)
      VALUES ($1, $2, 'comment', $3)
      `,
      [userId, postId, content]
    )

    await logActivity(userId, "COMMENT_POST", `Commented on post ${postId}`)
    res.status(201).json({ message: "Comment added" })
  } catch (err) {
    console.error("ERROR ADD COMMENT:", err)
    res.status(500).json({ message: "Failed to add comment" })
  }
}

/**
 * GET /posts/:postId/comments
 */
exports.getComments = async (req, res) => {
  const { postId } = req.params

  try {
    const result = await pool.query(
      `
      SELECT
        i.id,
        i.content,
        i.created_at,
        u.fullname,
        u.avatar_url
      FROM interactions i
      JOIN users u ON u.id = i.user_id
      WHERE i.post_id = $1 AND i.type = 'comment'
      ORDER BY i.created_at ASC
      `,
      [postId]
    )

    res.json(result.rows)
  } catch (err) {
    console.error("ERROR GET COMMENTS:", err)
    res.status(500).json({ message: "Failed to fetch comments" })
  }
}

/**
 * GET /posts/:postId/interactions
 * Summary
 */
exports.getInteractionSummary = async (req, res) => {
  const userId = req.user.id
  const { postId } = req.params

  try {
    const likes = await pool.query(
      `SELECT COUNT(*) FROM interactions WHERE post_id = $1 AND type = 'like'`,
      [postId]
    )

    const comments = await pool.query(
      `SELECT COUNT(*) FROM interactions WHERE post_id = $1 AND type = 'comment'`,
      [postId]
    )

    const bookmarked = await pool.query(
      `
      SELECT id FROM bookmarks
      WHERE post_id = $1 AND user_id = $2
      `,
      [postId, userId]
    )

    res.json({
      likes: Number(likes.rows[0].count),
      comments: Number(comments.rows[0].count),
      bookmarked: bookmarked.rowCount > 0
    })
  } catch (err) {
    console.error("ERROR GET INTERACTION SUMMARY:", err)
    res.status(500).json({ message: "Failed to fetch interactions" })
  }
}
