const pool = require("../db")
const { logActivity } = require("../helpers/activity-log.helper");

/**
 * GET /departments
 * Ambil semua jurusan
 */
exports.getDepartments = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT id, name
      FROM departments
      ORDER BY name
    `)

        res.json(result.rows)
    } catch (err) {
        console.error("ERROR GET DEPARTMENTS:", err)
        res.status(500).json({ message: "Failed to fetch departments" })
    }
}

/**
 * POST /departments
 * Tambah jurusan baru
 */
exports.createDepartment = async (req, res) => {
    const { name } = req.body

    if (!name) {
        return res.status(400).json({ message: "Department name is required" })
    }

    const existing = await pool.query(
        `SELECT id FROM departments WHERE LOWER(name) = LOWER($1)`,
        [name]
    );

    if (existing.rowCount > 0) {
        return res.status(409).json({
            message: "Department name already exists"
        });
    }


    try {
        const result = await pool.query(
            `
      INSERT INTO departments (name)
      VALUES ($1)
      RETURNING id, name
      `,
            [name]
        )

        res.status(201).json({
            message: "Department created successfully",
            department: result.rows[0]
        })
    } catch (err) {
  if (err.code === "23505") {
    return res.status(409).json({
      message: "Department name already exists"
    });
  }

  console.error("ERROR CREATE DEPARTMENT:", err);
  res.status(500).json({ message: "Failed to create department" });
}

}

/**
 * PUT /departments/:id
 * Update nama jurusan
 */
exports.updateDepartment = async (req, res) => {
    const { id } = req.params
    const { name } = req.body

    if (!name) {
        return res.status(400).json({ message: "Department name is required" })
    }
    const existing = await pool.query(
        `SELECT id FROM departments WHERE LOWER(name) = LOWER($1) AND id != $2`,
        [name, id]
    );

    if (existing.rowCount > 0) {
        return res.status(409).json({
            message: "Department name already exists"
        });
    }


    try {
        const result = await pool.query(
            `
      UPDATE departments
      SET name = $1
      WHERE id = $2
      RETURNING id, name
      `,
            [name, id]
        )

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Department not found" })
        }

        res.json({
            message: "Department updated successfully",
            department: result.rows[0]
        })
    } catch (err) {

        if (err.code === "23505") {
            return res.status(409).json({
                message: "Department name already exists"
            });
        }

        console.error("ERROR UPDATE DEPARTMENT:", err)
        res.status(500).json({ message: "Failed to update department" })
    }
}

/**
 * DELETE /departments/:id
 * Hapus jurusan
 */
exports.deleteDepartment = async (req, res) => {
    const { id } = req.params

    try {
        // hapus relasi kategori ↔ jurusan dulu
        await pool.query(
            "DELETE FROM category_departments WHERE department_id = $1",
            [id]
        )

        // hapus jurusan
        const result = await pool.query(
            `
      DELETE FROM departments
      WHERE id = $1
      RETURNING id
      `,
            [id]
        )

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Department not found" })
        }

        await logActivity({
            user_id: req.user.id,
            action: "DELETE_DEPARTMENT",
            description: `Deleted department ${id}`
        });



        res.json({ message: "Department deleted successfully" })
    } catch (err) {
        console.error("ERROR DELETE DEPARTMENT:", err)
        res.status(500).json({ message: "Failed to delete department" })
    }
}
