const pool = require("../db")
const { logActivity } = require("../helpers/activity-log.helper")

/**
 * POST /posts/:postId/bookmark
 */
exports.toggleBookmark = async (req, res) => {
  const userId = req.user.id
  const { postId } = req.params

  try {
    const check = await pool.query(
      `
      SELECT id FROM bookmarks
      WHERE user_id = $1 AND post_id = $2
      `,
      [userId, postId]
    )

    // ❌ sudah bookmark → hapus
    if (check.rowCount > 0) {
      await pool.query(
        `DELETE FROM bookmarks WHERE id = $1`,
        [check.rows[0].id]
      )

      return res.json({
        bookmarked: false
      })
    }

    // ✅ belum → insert
    await pool.query(
      `
      INSERT INTO bookmarks (user_id, post_id)
      VALUES ($1, $2)
      `,
      [userId, postId]
    )

    res.json({
      bookmarked: true
    })
  } catch (err) {
    console.error("ERROR TOGGLE BOOKMARK:", err)
    res.status(500).json({ message: "Failed to toggle bookmark" })
  }
}

/**
 * GET /bookmarks
 */
exports.getMyBookmarks = async (req, res) => {
  const userId = req.user.id

  try {
    const result = await pool.query(
      `
      SELECT
        p.id,
        p.title,
        p.description,
        p.created_at
      FROM bookmarks b
      JOIN posts p ON p.id = b.post_id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
      `,
      [userId]
    )

    res.json(result.rows)
  } catch (err) {
    console.error("ERROR GET BOOKMARKS:", err)
    res.status(500).json({ message: "Failed to fetch bookmarks" })
  }
}
