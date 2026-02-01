const pool = require("../db")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const { logActivity } = require("../helpers/activity-log.helper");


/**
 * =========================
 * LOGIN
 * POST /login
 * =========================
 */
exports.login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required"
    })
  }

  try {
    const result = await pool.query(
      `
      SELECT
        u.id AS user_id,
        u.fullname,
        u.email,
        u.password,
        u.onboarding_status,
        u.is_active,
        r.name AS role_name,
        d.id AS department_id,
        d.name AS department_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.email = $1
      `,
      [email]
    )

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    const user = result.rows[0]

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    if (user.onboarding_status !== "approved") {
      return res.status(403).json({
        message: "Account not approved by admin"
      })
    }

    if (!user.is_active) {
      return res.status(403).json({
        message: "Akun anda tidak aktif"
      })
    }

    const token = jwt.sign(
      {
        id: user.user_id,
        role: user.role_name,
        department_id: user.department_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    // ✅ SET COOKIE (KUNCI)
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // pakai "none" + secure=true kalau beda domain
      maxAge: 24 * 60 * 60 * 1000, // 1 hari
      path: "/"
    })

    await logActivity({
      user_id: user.user_id,
      action: "LOGIN",
      description: `${user.fullname} melakukan login`
    })

    // ❗ TIDAK kirim token ke frontend
    return res.json({
      user: {
        id: user.user_id,
        fullname: user.fullname,
        email: user.email,
        department: {
          id: user.department_id,
          name: user.department_name
        },
        role: {
          name: user.role_name
        },
        onboarding_status: user.onboarding_status
      }
    })
  } catch (err) {
    console.error("LOGIN ERROR:", err)
    return res.status(500).json({ message: "Login failed" })
  }
}

/**
 * =========================
 * REGISTER
 * POST /register
 * =========================
 */
exports.register = async (req, res) => {
  const {
    fullname,
    email,
    password,
    confirm_password,
    user_type,
    department_id,
    npm,
    nidn,
    occupation
  } = req.body

  // =========================
  // VALIDASI UMUM
  // =========================
  if (!fullname || !email || !password || !confirm_password || !user_type) {
    return res.status(400).json({
      message: "Required fields missing"
    })
  }

  if (password !== confirm_password) {
    return res.status(400).json({
      message: "Password confirmation mismatch"
    })
  }

  if (!["mahasiswa", "dosen", "others"].includes(user_type)) {
    return res.status(400).json({
      message: "Invalid user type"
    })
  }

  // =========================
  // VALIDASI BERDASARKAN USER TYPE
  // =========================
  if (user_type === "mahasiswa") {
    if (!npm || !department_id) {
      return res.status(400).json({
        message: "npm and department are required for mahasiswa"
      })
    }

    if (!email.endsWith("@std.ulbi.ac.id")) {
      return res.status(400).json({
        message: "Email domain not allowed for mahasiswa"
      })
    }
  }

  if (user_type === "dosen") {
    if (!nidn || !department_id) {
      return res.status(400).json({
        message: "nidn and department are required for dosen"
      })
    }

    if (!email.endsWith("@ulbi.ac.id")) {
      return res.status(400).json({
        message: "Email domain not allowed for dosen"
      })
    }
  }

  if (user_type === "others") {
    if (!occupation) {
      return res.status(400).json({
        message: "occupation is required for others"
      })
    }
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    )

    if (existing.rowCount > 0) {
      return res.status(409).json({
        message: "Email already registered"
      })
    }

    let roleId
    if (user_type === "dosen") roleId = 2
    else roleId = 3

    const hashedPassword = await bcrypt.hash(password, 10)

    // 🔥 FIX UTAMA DI SINI
    const result = await pool.query(
      `
    INSERT INTO users (
      id,
      fullname,
      email,
      password,
      role_id,
      user_type,
      department_id,
      npm,
      nidn,
      occupation,
      onboarding_status,
      is_active
    )
    VALUES (
      uuid_generate_v4(),
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      'pending',
      true
    )
    RETURNING id, fullname
    `,
      [
        fullname,
        email,
        hashedPassword,
        roleId,
        user_type,
        department_id || null,
        npm || null,
        nidn || null,
        occupation || null
      ]
    )

    const newUser = result.rows[0]

    // activity log OPTIONAL
    try {
      await logActivity({
        user_id: newUser.id,
        action: "REGISTER",
        description: `${newUser.fullname} baru saja melakukan registrasi`
      })
    } catch (logErr) {
      console.error("ACTIVITY LOG ERROR:", logErr)
    }

    // ⛔ WAJIB return
    return res.status(201).json({
      message: "Registration successful. Waiting for admin approval."
    })
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        message: "Duplicate email / npm / nidn detected"
      })
    }

    console.error("REGISTER ERROR:", err)
    return res.status(500).json({
      message: "Registration failed"
    })
  }

}

/** =========================
 * LOGOUT
 * POST /logout
 */

exports.logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })

  res.json({ message: "Logged out" })
}

/**
 * =========================
 * GET CURRENT USER
 * GET /me
 * =========================
 */
exports.me = async (req, res) => {
  try {
    const userId = req.user.id

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.fullname,
        u.email,
        u.onboarding_status,
        r.name AS role_name,
        d.id AS department_id,
        d.name AS department_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1
      `,
      [userId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    const user = result.rows[0]

    res.json({
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      onboarding_status: user.onboarding_status,
      role: {
        name: user.role_name,
      },
      department: user.department_id
        ? {
            id: user.department_id,
            name: user.department_name,
          }
        : null,
    })
  } catch (err) {
    console.error("GET ME ERROR:", err)
    res.status(500).json({ message: "Failed to fetch user" })
  }
}
