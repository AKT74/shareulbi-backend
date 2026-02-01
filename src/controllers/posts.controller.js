const pool = require("../db")
const { validate: isUUID } = require("uuid")
const supabase = require("../config/supabase");

/* ================= HELPER ================= */
function toPublicUrl(path) {
  if (!path) return null;

  // kalau sudah full URL, jangan diubah
  if (path.startsWith("http")) return path;

  return supabase.storage
    .from("post-files")
    .getPublicUrl(path).data.publicUrl;
}

/**
 * GET /posts
 */
exports.getPosts = async (req, res) => {
  const userId = req.user ? req.user.id : null;

  try {
    const result = await pool.query(
      `
      SELECT
        p.id,
        p.title,
        p.description,
        p.type,
        p.status,
        p.created_at,
        p.updated_at,

        u.id AS user_id,
        u.fullname AS author_name,
        r.name AS author_role,
        d.name AS department,

        -- 🔥 FILE (SATU SAJA)
        pf.file_type,
        pf.file_url,
        pf.thumbnail_url,
        pf.duration,
        pf.meta,

        -- categories
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'is_related_to_campus', c.is_related_to_campus
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) AS categories,

        -- counts
        COUNT(DISTINCT i_like.id) AS likes_count,
        COUNT(DISTINCT i_comment.id) AS comments_count,

        -- flags (NULL SAFE)
        CASE
          WHEN $1::uuid IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM interactions il
            WHERE il.post_id = p.id
              AND il.user_id = $1
              AND il.type = 'like'
          )
        END AS is_liked,

        CASE
          WHEN $1::uuid IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM bookmarks b
            WHERE b.post_id = p.id
              AND b.user_id = $1
          )
        END AS is_bookmarked

      FROM posts p
      JOIN users u ON u.id = p.user_id
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN departments d ON d.id = u.department_id

      -- 🔥 ambil 1 file saja per post
      LEFT JOIN LATERAL (
        SELECT *
        FROM post_files pf
        WHERE pf.post_id = p.id
        ORDER BY
          CASE
            WHEN pf.file_type LIKE 'video%' THEN 1
            WHEN pf.file_type = 'application/pdf' THEN 2
            ELSE 3
          END
        LIMIT 1
      ) pf ON true

      LEFT JOIN post_categories pc ON pc.post_id = p.id
      LEFT JOIN categories c ON c.id = pc.category_id

      LEFT JOIN interactions i_like
        ON i_like.post_id = p.id AND i_like.type = 'like'

      LEFT JOIN interactions i_comment
        ON i_comment.post_id = p.id AND i_comment.type = 'comment'

      GROUP BY
        p.id,
        u.id,
        r.name,
        d.name,
        pf.file_type,
        pf.file_url,
        pf.thumbnail_url,
        pf.duration,
        pf.meta

      ORDER BY p.created_at DESC
      `,
      [userId]
    );

    const posts = result.rows.map((row) => {
      let preview_page = null;
      let total_pages = null;
      let thumbnail_url = null;
      let duration = null;

      if (row.file_type === "application/pdf" && row.meta) {
        total_pages = row.meta.total_pages || 0;
        preview_page = row.meta.pages?.[0]
          ? toPublicUrl(row.meta.pages[0])
          : null;
      }

      if (row.file_type?.startsWith("video")) {
        thumbnail_url = toPublicUrl(row.thumbnail_url);
        duration = row.duration;
      }

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        type: row.type,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,

        user_id: row.user_id,
        author_name: row.author_name,
        author_role: row.author_role,
        department: row.department,

        categories: row.categories,

        thumbnail_url,
        duration,
        preview_page,
        total_pages,

        likes_count: Number(row.likes_count),
        comments_count: Number(row.comments_count),
        is_liked: row.is_liked,
        is_bookmarked: row.is_bookmarked,
      };
    });

    res.json(posts);
  } catch (err) {
    console.error("ERROR GET POSTS:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};



/* ================= GET POST BY ID ================= */
exports.getPostById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || null;

  if (!isUUID(id)) {
    return res.status(400).json({ message: "Invalid post id format" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        p.id,
        p.title,
        p.description,
        p.type,
        p.status,
        p.created_at,
        p.updated_at,

        -- author
        u.id AS author_id,
        u.fullname AS author_name,
        r.name AS author_role,
        d.name AS department,

        -- 🔥 FILES (ALL TYPES)
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'file_url', pf.file_url,
              'file_type', pf.file_type,
              'duration', pf.duration,
              'thumbnail_url', pf.thumbnail_url,
              'meta', pf.meta
            )
          ) FILTER (WHERE pf.id IS NOT NULL),
          '[]'
        ) AS files,

        -- categories
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'is_related_to_campus', c.is_related_to_campus
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) AS categories,

        -- interaction counts
        COUNT(DISTINCT i_like.id) AS likes_count,
        COUNT(DISTINCT i_comment.id) AS comments_count,

        -- user flags
        EXISTS (
          SELECT 1 FROM interactions il
          WHERE il.post_id = p.id
            AND il.user_id = $2
            AND il.type = 'like'
        ) AS is_liked,

        EXISTS (
          SELECT 1 FROM bookmarks b
          WHERE b.post_id = p.id
            AND b.user_id = $2
        ) AS is_bookmarked

      FROM posts p
      JOIN users u ON u.id = p.user_id
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN departments d ON d.id = u.department_id

      LEFT JOIN post_files pf ON pf.post_id = p.id
      LEFT JOIN post_categories pc ON pc.post_id = p.id
      LEFT JOIN categories c ON c.id = pc.category_id

      LEFT JOIN interactions i_like
        ON i_like.post_id = p.id AND i_like.type = 'like'

      LEFT JOIN interactions i_comment
        ON i_comment.post_id = p.id AND i_comment.type = 'comment'

      WHERE p.id = $1

      GROUP BY
        p.id,
        u.id,
        r.name,
        d.name
      `,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    const row = result.rows[0];

    /* ================= FIX FILE URL ================= */
    const files = row.files.map((file) => ({
      ...file,

      // video/pdf
      file_url: toPublicUrl(file.file_url),

      // thumbnail video
      thumbnail_url: toPublicUrl(file.thumbnail_url),

      // 🔥 PDF pages
      meta: file.meta
        ? {
            ...file.meta,
            pages: Array.isArray(file.meta.pages)
              ? file.meta.pages.map(toPublicUrl)
              : [],
          }
        : null,
    }));

    /* ================= RESPONSE ================= */
    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,

      author: {
        id: row.author_id,
        name: row.author_name,
        role: row.author_role,
        department: row.department,
      },

      categories: row.categories,
      files,

      likes_count: Number(row.likes_count),
      comments_count: Number(row.comments_count),
      is_liked: row.is_liked,
      is_bookmarked: row.is_bookmarked,
    });
  } catch (err) {
    console.error("ERROR GET POST BY ID:", err);
    res.status(500).json({ message: "Failed to fetch post" });
  }
};


/**
 * POST /posts
 * ⬅️ INI YANG BERUBAH
 */
exports.createPost = async (req, res) => {
  const { title, description, type, category_id } = req.body
  const userId = req.user.id

  if (!title || !category_id) {
    return res.status(400).json({ message: "title and category_id are required" })
  }

  try {
    // 1. cek kategori
    const categoryResult = await pool.query(
      "SELECT is_related_to_campus FROM categories WHERE id = $1",
      [category_id]
    )

    if (categoryResult.rowCount === 0) {
      return res.status(404).json({ message: "Category not found" })
    }

    const isRelated = categoryResult.rows[0].is_related_to_campus
    const status = isRelated ? "published" : "not_validatable"

    // 2. insert post
    const postResult = await pool.query(
      `
      INSERT INTO posts (title, description, type, status, user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [title, description, type, status, userId]
    )

    const post = postResult.rows[0]

    // 3. relasi ke kategori
    await pool.query(
      `
      INSERT INTO post_categories (post_id, category_id)
      VALUES ($1, $2)
      `,
      [post.id, category_id]
    )

    res.status(201).json(post)
  } catch (err) {
    console.error("ERROR CREATE POST:", err)
    res.status(500).json({ message: "Failed to create post" })
  }
}

/**
 * PUT /posts/:id
 * update title, description, category
 * auto update status based on category
 */
exports.updatePost = async (req, res) => {
  const { id } = req.params
  const { title, description, category_id } = req.body
  const userId = req.user.id

  if (!isUUID(id)) {
    return res.status(400).json({ message: "Invalid post id format" })
  }

  if (!title || title.length < 5) {
    return res.status(400).json({ message: "Title minimal 5 karakter" })
  }

  if (!description || description.length < 5) {
    return res.status(400).json({ message: "Description minimal 5 karakter" })
  }

  try {
    await pool.query("BEGIN")

    /* 🔍 cek post */
    const postRes = await pool.query(
      `SELECT status FROM posts WHERE id = $1 AND user_id = $2`,
      [id, userId]
    )

    if (postRes.rowCount === 0) {
      await pool.query("ROLLBACK")
      return res.status(404).json({ message: "Post not found" })
    }

    const currentStatus = postRes.rows[0].status

    /* 🔍 cek kategori */
    const catRes = await pool.query(
      `SELECT is_related_to_campus FROM categories WHERE id = $1`,
      [category_id]
    )

    if (catRes.rowCount === 0) {
      await pool.query("ROLLBACK")
      return res.status(404).json({ message: "Category not found" })
    }

    const isRelated = catRes.rows[0].is_related_to_campus

    /* 🔥 hitung status baru */
    let newStatus = currentStatus

    if (currentStatus !== "validated") {
      newStatus = isRelated ? "published" : "not_validatable"
    }

    /* 🔥 update post */
    await pool.query(
      `
      UPDATE posts
      SET title = $1,
          description = $2,
          status = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      `,
      [title, description, newStatus, id]
    )

    /* 🔥 update kategori */
    await pool.query(
      `DELETE FROM post_categories WHERE post_id = $1`,
      [id]
    )

    await pool.query(
      `
      INSERT INTO post_categories (post_id, category_id)
      VALUES ($1, $2)
      `,
      [id, category_id]
    )

    await pool.query("COMMIT")

    res.json({
      message: "Post updated",
      status: newStatus,
    })
  } catch (err) {
    await pool.query("ROLLBACK")
    console.error("ERROR UPDATE POST:", err)
    res.status(500).json({ message: "Failed to update post" })
  }
}

/**
 * DELETE /posts/:id
 */
exports.deletePost = async (req, res) => {
  const { id } = req.params

  try {
    await pool.query("BEGIN")

    // 🔥 HAPUS SEMUA RELASI DULU
    await pool.query("DELETE FROM post_categories WHERE post_id = $1", [id])
    await pool.query("DELETE FROM post_files WHERE post_id = $1", [id])
    await pool.query("DELETE FROM bookmarks WHERE post_id = $1", [id])
    await pool.query("DELETE FROM interactions WHERE post_id = $1", [id])
    await pool.query("DELETE FROM post_validations WHERE post_id = $1", [id])

    // 🗑️ BARU HAPUS POST
    const result = await pool.query(
      "DELETE FROM posts WHERE id = $1 RETURNING id",
      [id]
    )

    if (result.rowCount === 0) {
      await pool.query("ROLLBACK")
      return res.status(404).json({ message: "Post not found" })
    }

    await pool.query("COMMIT")

    res.json({ message: "Post deleted", id })
  } catch (err) {
    await pool.query("ROLLBACK")
    console.error("ERROR DELETE POST:", err)
    res.status(500).json({ message: "Failed to delete post" })
  }
}
