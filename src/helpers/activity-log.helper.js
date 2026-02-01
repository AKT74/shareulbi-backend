const pool = require("../db")

exports.logActivity = async ({ user_id, action, description = null }) => {
  console.log("LOG ACTIVITY CALLED:", {
    user_id,
    action,
    description,
  })

  if (!user_id || !action) {
    console.error("ACTIVITY LOG ERROR: invalid payload", {
      user_id,
      action,
      description,
    })
    return
  }

  try {
    await pool.query(
      `
      INSERT INTO activity_logs (user_id, action, description)
      VALUES ($1, $2, $3)
      `,
      [user_id, action, description]
    )

    console.log("ACTIVITY LOG INSERTED")
  } catch (err) {
    console.error("ACTIVITY LOG ERROR:", err.message)
  }
}
