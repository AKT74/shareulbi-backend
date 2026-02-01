const pool = require("../db")
const { logActivity } = require("../helpers/activity-log.helper")

/**
 * GET /categories
 */
exports.getCategories = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.is_related_to_campus,
        COALESCE(
          json_agg(
            json_build_object(
              'id', d.id,
              'name', d.name
            )
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'
        ) AS departments
      FROM categories c
      LEFT JOIN category_departments cd ON cd.category_id = c.id
      LEFT JOIN departments d ON d.id = cd.department_id
      GROUP BY c.id
      ORDER BY c.name
    `)

        res.json(result.rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to fetch categories" })
    }
}

/**
 * POST /categories
 */
exports.createCategory = async (req, res) => {
    const { name, is_related_to_campus = true, department_ids = [] } = req.body

    if (!name) {
        return res.status(400).json({ message: "Category name is required" })
    }
    // cek duplikat (case-insensitive)
    const existing = await pool.query(
        `SELECT id FROM categories WHERE LOWER(name) = LOWER($1)`,
        [name]
    );

    if (existing.rowCount > 0) {
        return res.status(409).json({
            message: "Category name already exists"
        });
    }


    try {
        const categoryResult = await pool.query(
            `
      INSERT INTO categories (name, is_related_to_campus)
      VALUES ($1, $2)
      RETURNING id
      `,
            [name, is_related_to_campus]
        )

        const categoryId = categoryResult.rows[0].id

        if (is_related_to_campus && department_ids.length > 0) {
            for (const deptId of department_ids) {
                await pool.query(
                    `
          INSERT INTO category_departments (category_id, department_id)
          VALUES ($1, $2)
          `,
                    [categoryId, deptId]
                )
            }
        }
        await logActivity({
            user_id: req.user.id,
            action: "CREATE_CATEGORY",
            description: `Created category ${name}`
        });



        res.status(201).json({ message: "Category created", categoryId })
    } catch (err) {

        if (err.code === "23505") {
            return res.status(409).json({
                message: "Category name already exists"
            });
        }

        console.error(err)
        res.status(500).json({ message: "Failed to create category" })
    }
}

/**
 * PUT /categories/:id
 */
exports.updateCategory = async (req, res) => {
    const { id } = req.params
    const { name, is_related_to_campus, department_ids = [] } = req.body

    // cek duplikat (case-insensitive)
    const existing = await pool.query(
        `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2`,
        [name, id]
    );


    if (existing.rowCount > 0) {
        return res.status(409).json({
            message: "Category name already exists"
        });
    }

    try {
        const result = await pool.query(
            `
      UPDATE categories
      SET
        name = COALESCE($1, name),
        is_related_to_campus = COALESCE($2, is_related_to_campus)
      WHERE id = $3
      RETURNING is_related_to_campus
      `,
            [name, is_related_to_campus, id]
        )

        if (name) {
            const existing = await pool.query(
                `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2`,
                [name, id]
            );

            if (existing.rowCount > 0) {
                return res.status(409).json({ message: "Category name already exists" });
            }
        }

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Category not found" })
        }

        await pool.query(
            "DELETE FROM category_departments WHERE category_id = $1",
            [id]
        )

        if (result.rows[0].is_related_to_campus && department_ids.length > 0) {
            for (const deptId of department_ids) {
                await pool.query(
                    `
          INSERT INTO category_departments (category_id, department_id)
          VALUES ($1, $2)
          `,
                    [id, deptId]
                )
            }
        }

        res.json({ message: "Category updated" })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to update category" })
    }
}

/**
 * DELETE /categories/:id
 */
exports.deleteCategory = async (req, res) => {
    const { id } = req.params

    try {
        // hapus relasi dulu
        await pool.query(
            "DELETE FROM post_categories WHERE category_id = $1",
            [id]
        )

        await pool.query(
            "DELETE FROM category_departments WHERE category_id = $1",
            [id]
        )

        // baru hapus kategori
        const result = await pool.query(
            "DELETE FROM categories WHERE id = $1 RETURNING id",
            [id]
        )

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Category not found" })
        }

        await logActivity({
            user_id: req.user.id,
            action: "DELETE_CATEGORY",
            description: `Deleted category ${id}`
        });


        res.json({ message: "Category deleted successfully" })
    } catch (err) {
        console.error("ERROR DELETE CATEGORY:", err)
        res.status(500).json({ message: "Failed to delete category" })
    }
}

