const pool = require("../db")
const { validate: isUUID } = require("uuid")

// GET /api/users/pending/count
exports.getPendingUserCount = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM users WHERE onboarding_status = 'pending'"
    )

    res.json({
      count: parseInt(result.rows[0].count)
    })
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
}


/**
 * GET /admin/users/pending
 * Ambil semua user pending approval
 */
exports.getPendingUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.fullname,
        u.email,
        u.npm,
        u.nidn,
        u.occupation,
        u.user_type,
        u.onboarding_status,
        r.name AS role,
        d.name AS department
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.onboarding_status = 'pending'
      ORDER BY u.created_at ASC
      `
    )

    res.json(result.rows)
  } catch (err) {
    console.error("GET PENDING USERS ERROR:", err)
    res.status(500).json({ message: "Failed to fetch pending users" })
  }
}

/**
 * PATCH /admin/users/:id/approve
 * Approve user onboarding
 */
exports.approveUser = async (req, res) => {
  const { id } = req.params

  if (!isUUID(id)) {
    return res.status(400).json({ message: "Invalid user id format" })
  }

  try {
    const result = await pool.query(
      `
      UPDATE users
      SET onboarding_status = 'approved'
      WHERE id = $1 AND onboarding_status = 'pending'
      RETURNING id, fullname, email, onboarding_status
      `,
      [id]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "User not found or already processed"
      })
    }

    res.json({
      message: "User approved successfully",
      user: result.rows[0]
    })
  } catch (err) {
    console.error("APPROVE USER ERROR:", err)
    res.status(500).json({ message: "Failed to approve user" })
  }
}

/**
 * PATCH /admin/users/:id/reject
 * Reject user onboarding
 */
exports.rejectUser = async (req, res) => {
  const { id } = req.params

  if (!isUUID(id)) {
    return res.status(400).json({ message: "Invalid user id format" })
  }

  try {
    const result = await pool.query(
      `
      UPDATE users
      SET onboarding_status = 'rejected'
      WHERE id = $1 AND onboarding_status = 'pending'
      RETURNING id, fullname, email, onboarding_status
      `,
      [id]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "User not found or already processed"
      })
    }

    res.json({
      message: "User rejected successfully",
      user: result.rows[0]
    })
  } catch (err) {
    console.error("REJECT USER ERROR:", err)
    res.status(500).json({ message: "Failed to reject user" })
  }
}
