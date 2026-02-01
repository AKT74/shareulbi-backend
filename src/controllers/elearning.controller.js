const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db"); // pg pool
const supabase = require("../config/supabase");

const getDuration = require("../utils/getVideoDuration");
const generateThumbnail = require("../utils/generateThumbnail");

exports.createELearning = async (req, res) => {
  const client = await pool.connect();
  const tempDir = "tmp";

  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  try {
    const { title, description, category_id } = req.body;
    const userId = req.user.id;
    const file = req.file;

    // ======================
    // VALIDATION
    // ======================
    if (!title || title.length < 5)
      return res.status(400).json({ message: "Judul minimal 5 karakter" });

    if (!description || description.length < 5)
      return res.status(400).json({ message: "Deskripsi minimal 5 karakter" });

    if (!file)
      return res.status(400).json({ message: "Video wajib diupload" });

    // ======================
    // TEMP VIDEO
    // ======================
    const fileId = uuidv4();
    const videoPath = path.join(tempDir, `${fileId}.mp4`);
    fs.writeFileSync(videoPath, file.buffer);

    // ======================
    // VIDEO PROCESSING
    // ======================
    const duration = await getDuration(videoPath);

    const thumbnailPath = await generateThumbnail(
      videoPath,
      tempDir,
      fileId
    );

    // ======================
    // UPLOAD TO SUPABASE
    // ======================
    await supabase.storage
      .from("post-files")
      .upload(`videos/${fileId}.mp4`, fs.readFileSync(videoPath), {
        contentType: "video/mp4",
      });

    await supabase.storage
      .from("post-files")
      .upload(
        `thumbnails/${fileId}.jpg`,
        fs.readFileSync(thumbnailPath),
        { contentType: "image/jpeg" }
      );

    const videoUrl = supabase.storage
      .from("post-files")
      .getPublicUrl(`videos/${fileId}.mp4`).data.publicUrl;

    const thumbnailUrl = supabase.storage
      .from("post-files")
      .getPublicUrl(`thumbnails/${fileId}.jpg`).data.publicUrl;

    // ======================
    // DATABASE TRANSACTION
    // ======================
    await client.query("BEGIN");

    let status = "published"

if (category_id) {
  const categoryRes = await client.query(
    `SELECT is_related_to_campus FROM categories WHERE id = $1`,
    [category_id]
  )

  if (
    categoryRes.rows.length &&
    categoryRes.rows[0].is_related_to_campus === false
  ) {
    status = "not_validatable"
  }
}

    // 1️⃣ insert posts
    const postResult = await client.query(
      `
      INSERT INTO posts (title, description, type, status, user_id)
      VALUES ($1, $2, 'e-learning', $3, $4)
      RETURNING id
      `,
      [title, description, status, userId]
    );

    const postId = postResult.rows[0].id;

    // 2️⃣ insert category relation
    if (category_id) {
      await client.query(
        `
        INSERT INTO post_categories (post_id, category_id)
        VALUES ($1, $2)
        `,
        [postId, category_id]
      );
    }

    // 3️⃣ insert post_files (video)
    await client.query(
      `
      INSERT INTO post_files 
        (post_id, file_url, file_type, file_size, duration, thumbnail_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        postId,
        videoUrl,
        "video/mp4",
        file.size,
        duration,
        thumbnailUrl,
      ]
    );

    await client.query("COMMIT");

    // ======================
    // CLEANUP
    // ======================
    fs.unlinkSync(videoPath);
    fs.unlinkSync(thumbnailPath);

    res.status(201).json({
      message: "E-learning berhasil dibuat",
      post_id: postId,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
  console.log("BODY:", req.body);
console.log("FILE:", req.file);

};

/**
 * GET /api/e-learning
 * List e-learning (card-ready)
 */
exports.getELearningList = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.title,
        p.created_at,
        p.status,
        u.fullname AS author_name,

        -- category
        c.id AS category_id,
        c.name AS category_name,

        -- file
        pf.duration,
        pf.thumbnail_url
      FROM posts p
      JOIN users u ON u.id = p.user_id

      LEFT JOIN post_categories pc ON pc.post_id = p.id
      LEFT JOIN categories c ON c.id = pc.category_id

      LEFT JOIN post_files pf
        ON pf.post_id = p.id
       AND pf.file_type LIKE 'video%'

      WHERE p.type = 'e-learning'
      ORDER BY p.created_at DESC
    `)

    // 🔁 bentuk ulang agar SAMA seperti /api/posts
    const map = {}

    for (const row of result.rows) {
      if (!map[row.id]) {
        map[row.id] = {
          id: row.id,
          title: row.title,
          created_at: row.created_at,
          status: row.status,
          author_name: row.author_name,
          categories: [],
          duration: row.duration,
          thumbnail_url: row.thumbnail_url,
        }
      }

      if (row.category_id) {
        map[row.id].categories.push({
          id: row.category_id,
          name: row.category_name,
        })
      }
    }

    res.json(Object.values(map))
  } catch (err) {
    console.error(err)
    res.status(500).json({
      message: "Gagal mengambil daftar e-learning",
    })
  }
}

