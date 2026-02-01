const pool = require("../db")

exports.isOwnerOrAdmin = async (req, res, next) => {
  console.log("=== OWNERSHIP CHECK ===")
  console.log("REQ.USER =", req.user)
  console.log("REQ.PARAMS.ID =", req.params.id)

  const postId = req.params.id
  const userId = req.user.id

  const roleName =
    typeof req.user.role === "string"
      ? req.user.role
      : req.user.role?.name

  console.log("ROLE NAME =", roleName)

  if (roleName === "admin") {
    console.log("ADMIN BYPASS OWNERSHIP ✔")
    return next()
  }

  try {
    const result = await pool.query(
      "SELECT user_id FROM posts WHERE id = $1",
      [postId]
    )

    console.log("POST OWNER =", result.rows[0]?.user_id)
    console.log("REQUEST USER =", userId)

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Post not found" })
    }

    if (result.rows[0].user_id !== userId) {
      return res.status(403).json({
        message: "Forbidden: you can only modify your own post",
      })
    }

    next()
  } catch (err) {
    console.error("OWNERSHIP CHECK ERROR:", err)
    res.status(500).json({ message: "Server error" })
  }
}
