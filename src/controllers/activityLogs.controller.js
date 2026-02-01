const pool = require("../db")

exports.getActivityLogs = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        al.id,
        u.fullname,
        al.action,
        al.description,
        al.created_at
      FROM activity_logs al
      JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      `
    )

    res.json(result.rows)
  } catch (err) {
    console.error("ERROR GET ACTIVITY LOGS:", err)
    res.status(500).json({ message: "Failed to fetch activity logs" })
  }
}
