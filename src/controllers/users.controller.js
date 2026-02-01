const pool = require("../db")
const bcrypt = require("bcrypt")
const { logActivity } = require("../helpers/activity-log.helper")

/**
 * GET /users/me
 * Ambil profil user yang sedang login
 */
exports.getMyProfile = async (req, res) => {
    const userId = req.user.id
    console.log("REQ.USER =", req.user)

    try {
        const result = await pool.query(
            `
      SELECT
        u.id,
        u.fullname,
        u.email,
        u.avatar_url,
        u.bio,
        u.personal_link,
        u.user_type,
        u.npm,
        u.nidn,
        u.occupation,
        u.is_active,
        r.name AS role,
        d.name AS department,
        u.created_at,
        u.updated_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1
      `,
            [userId]
        )

        res.json(result.rows[0])
    } catch (err) {
        console.error("ERROR GET MY PROFILE:", err)
        res.status(500).json({ message: "Failed to fetch profile" })
    }
}

/**
 * PUT /users/me
 * User update own profile
 */
exports.updateMyProfile = async (req, res) => {
    const userId = req.user.id;
    const { avatar_url, bio, personal_link } = req.body;

    try {
        await pool.query(
            `
      UPDATE users
      SET
        avatar_url = COALESCE($1, avatar_url),
        bio = COALESCE($2, bio),
        personal_link = COALESCE($3, personal_link),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      `,
            [avatar_url, bio, personal_link, userId]
        );

        // ✅ ACTIVITY LOG
        await logActivity({
            user_id: userId,
            action: "UPDATE_PROFILE",
            description: "User memperbarui profilnya"
        });

        res.json({ message: "Profile updated successfully" });
    } catch (err) {
        console.error("ERROR UPDATE PROFILE:", err);
        res.status(500).json({ message: "Failed to update profile" });
    }
};


/**
 * GET /users
 * Admin: list semua user
 */
exports.getUsers = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        u.id,
        u.fullname,
        u.email,
        u.is_active,
        u.onboarding_status,
        u.avatar_url,
        u.bio,
        u.personal_link,
        r.name AS role,
        u.user_type,
        u.npm,
        u.nidn,
        u.occupation,
        d.name AS department,
        u.created_at,
        u.updated_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN departments d ON d.id = u.department_id
      ORDER BY u.created_at DESC
    `)

        res.json(result.rows)
    } catch (err) {
        console.error("ERROR GET USERS:", err)
        res.status(500).json({ message: "Failed to fetch users" })
    }
}

/**
 * GET /users/:id
 * Admin: ambil detail user by id
 */
exports.getUserById = async (req, res) => {
    const { id } = req.params

    try {
        const result = await pool.query(
            `
      SELECT
        u.id,
        u.fullname,
        u.email,
        u.is_active,
        u.onboarding_status,
        u.avatar_url,
        u.bio,
        u.personal_link,
        u.user_type,
        u.npm,
        u.nidn,
        u.occupation,
        u.role_id,
        r.name AS role,
        u.department_id,
        d.name AS department,
        u.created_at,
        u.updated_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1
      `,
            [id]
        )

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "User not found" })
        }

        res.json(result.rows[0])
    } catch (err) {
        console.error("ERROR GET USER BY ID:", err)
        res.status(500).json({ message: "Failed to fetch user" })
    }
}


/**
 * PUT /users/:id
 * Admin: edit semua data user (auto-adjust by user_type)
 */
exports.updateUserByAdmin = async (req, res) => {
    const { id } = req.params
    const {
        fullname,
        email,
        password,
        role_id,
        department_id,
        avatar_url,
        bio,
        personal_link,
        is_active,
        npm,
        nidn,
        occupation,
        user_type // optional
    } = req.body

    try {
        // ambil user lama (untuk user_type & validasi)
        const existingUser = await pool.query(
            "SELECT user_type FROM users WHERE id = $1",
            [id]
        )

        if (existingUser.rowCount === 0) {
            return res.status(404).json({ message: "User not found" })
        }

        const finalUserType = user_type || existingUser.rows[0].user_type

        let hashedPassword = null
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10)
        }

        // ===== AUTO ADJUST FIELD BY USER TYPE =====
        let finalNpm = npm
        let finalNidn = nidn
        let finalOccupation = occupation
        let finalDepartmentId = department_id

        if (finalUserType === "mahasiswa") {
            finalNidn = null
            finalOccupation = null
        } else if (finalUserType === "dosen") {
            finalNpm = null
            finalOccupation = null
        } else if (finalUserType === "others") {
            finalNpm = null
            finalNidn = null
            finalDepartmentId = null

            if (!occupation) {
                return res.status(400).json({
                    message: "Occupation is required for user type 'others'"
                })
            }
        }

        const result = await pool.query(
            `
      UPDATE users
      SET
        fullname = COALESCE($1, fullname),
        email = COALESCE($2, email),
        password = COALESCE($3, password),
        role_id = COALESCE($4, role_id),
        department_id = $5,
        avatar_url = COALESCE($6, avatar_url),
        bio = COALESCE($7, bio),
        personal_link = COALESCE($8, personal_link),
        is_active = COALESCE($9, is_active),
        npm = $10,
        nidn = $11,
        occupation = $12,
        user_type = $13,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING id
      `,
            [
                fullname,
                email,
                hashedPassword,
                role_id,
                finalDepartmentId,
                avatar_url,
                bio,
                personal_link,
                is_active,
                finalNpm,
                finalNidn,
                finalOccupation,
                finalUserType,
                id
            ]
        )

        // Activity log
        await logActivity({
            user_id: req.user.id,
            action: "UPDATE_USER",
            description: `Admin updated user ${id}`
        });


        res.json({ message: "User updated successfully" })
    } catch (err) {
        console.error("ERROR UPDATE USER BY ADMIN:", err)
        res.status(500).json({ message: "Failed to update user" })
    }
}
