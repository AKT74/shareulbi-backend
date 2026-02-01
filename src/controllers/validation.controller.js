const pool = require("../db")
const { logActivity } = require("../helpers/activity-log.helper")

/**
 * GET /validation/posts
 * List post yang bisa divalidasi dosen
 * - E-learning & Works
 * - status = published (pending)
 * - kategori akademik
 * - sesuai jurusan dosen
 */
exports.getValidatablePosts = async (req, res) => {
  const dosenDepartmentId = req.user.department_id

  try {
    const result = await pool.query(
      `
      SELECT DISTINCT
        p.id,
        p.title,
        p.type,               -- 👈 PENTING
        p.created_at,
        u.fullname AS author_name,
        c.name AS category
      FROM posts p
      JOIN users u ON u.id = p.user_id
      JOIN post_categories pc ON pc.post_id = p.id
      JOIN categories c ON c.id = pc.category_id
      JOIN category_departments cd ON cd.category_id = c.id
      WHERE
        p.status = 'published'
        AND c.is_related_to_campus = true
        AND cd.department_id = $1
      ORDER BY p.created_at DESC
      `,
      [dosenDepartmentId]
    )

    res.json(result.rows)
  } catch (err) {
    console.error("ERROR GET VALIDATABLE POSTS:", err)
    res.status(500).json({ message: "Failed to fetch posts" })
  }
}

/**
 * POST /validation/posts/:postId/validate
 * Dosen approve / reject post
 */
exports.validatePost = async (req, res) => {
  const { postId } = req.params
  const { status } = req.body
  const dosenId = req.user.id
  const dosenDepartmentId = req.user.department_id

  if (!["validated", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid validation status" })
  }

  try {
    // cek hak validasi dosen
    const check = await pool.query(
      `
      SELECT p.id
      FROM posts p
      JOIN post_categories pc ON pc.post_id = p.id
      JOIN categories c ON c.id = pc.category_id
      JOIN category_departments cd ON cd.category_id = c.id
      WHERE
        p.id = $1
        AND p.status = 'published'
        AND c.is_related_to_campus = true
        AND cd.department_id = $2
      `,
      [postId, dosenDepartmentId]
    )

    if (check.rowCount === 0) {
      return res.status(403).json({
        message: "You are not allowed to validate this post"
      })
    }

    // simpan riwayat validasi
    await pool.query(
      `
      INSERT INTO post_validations (post_id, validator_id, status)
      VALUES ($1, $2, $3)
      `,
      [postId, dosenId, status]
    )

    // update status post
    await pool.query(
      `
      UPDATE posts
      SET status = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [status, postId]
    )

    // activity log
    logActivity(
      dosenId,
      "VALIDATE_POST",
      `Post ${postId} set to ${status}`
    )

    res.json({ message: "Post validation successful" })
  } catch (err) {
    console.error("ERROR VALIDATE POST:", err)
    res.status(500).json({ message: "Failed to validate post" })
  }
}
