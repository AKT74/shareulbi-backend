const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const supabase = require("../config/supabase");
const countPdfPages = require("../utils/countPdfPages");
const convertPdfToImages = require("../utils/convertPdfToImages");

/* ================= HELPER ================= */
function toPublicUrl(filePath) {
  if (!filePath) return null;
  if (filePath.startsWith("http")) return filePath;

  return supabase.storage
    .from("post-files")
    .getPublicUrl(filePath).data.publicUrl;
}

/* =====================================================
   CREATE WORKS (UPLOAD PDF + GENERATE IMAGE PREVIEW)
===================================================== */
exports.createWorks = async (req, res) => {
  const client = await pool.connect();
  const tempDir = "tmp";

  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  try {
    const { title, description, category_id } = req.body;
    const userId = req.user.id;
    const file = req.file;

    /* ============ VALIDATION ============ */
    if (!title || title.length < 5)
      return res.status(400).json({ message: "Judul minimal 5 karakter" });

    if (!description || description.length < 5)
      return res.status(400).json({ message: "Deskripsi minimal 5 karakter" });

    if (!category_id)
      return res.status(400).json({ message: "Kategori wajib dipilih" });

    if (!file)
      return res.status(400).json({ message: "PDF wajib diupload" });

    /* ============ TEMP PDF ============ */
    const fileId = uuidv4();
    const pdfPath = path.join(tempDir, `${fileId}.pdf`);
    fs.writeFileSync(pdfPath, file.buffer);

    /* ============ PDF → IMAGE ============ */
    const totalPages = await countPdfPages(file.buffer);

    const imagePaths = await convertPdfToImages(
      pdfPath,
      tempDir,
      `${fileId}_page`
    );

    /* ============ UPLOAD PDF ============ */
    await supabase.storage
      .from("post-files")
      .upload(`works/${fileId}.pdf`, fs.readFileSync(pdfPath), {
        contentType: "application/pdf",
      });

    /* ============ UPLOAD IMAGES ============ */
    const pages = [];

    for (let i = 0; i < imagePaths.length; i++) {
      const buffer = fs.readFileSync(imagePaths[i]);
      const fileName = `works/${fileId}_page_${i + 1}.png`;

      await supabase.storage
        .from("post-files")
        .upload(fileName, buffer, {
          contentType: "image/png",
        });

      pages.push(fileName);
    }

    /* ============ STATUS BY CATEGORY ============ */
    let status = "published";

    const catRes = await pool.query(
      `SELECT is_related_to_campus FROM categories WHERE id = $1`,
      [category_id]
    );

    if (
      catRes.rows.length &&
      catRes.rows[0].is_related_to_campus === false
    ) {
      status = "not_validatable";
    }

    /* ============ DB TRANSACTION ============ */
    await client.query("BEGIN");

    const postRes = await client.query(
      `
      INSERT INTO posts (title, description, type, status, user_id)
      VALUES ($1, $2, 'works', $3, $4)
      RETURNING id
      `,
      [title, description, status, userId]
    );

    const postId = postRes.rows[0].id;

    await client.query(
      `
      INSERT INTO post_categories (post_id, category_id)
      VALUES ($1, $2)
      `,
      [postId, category_id]
    );

    await client.query(
      `
      INSERT INTO post_files
        (post_id, file_url, file_type, file_size, meta)
      VALUES ($1, $2, 'application/pdf', $3, $4)
      `,
      [
        postId,
        `works/${fileId}.pdf`,
        file.size,
        JSON.stringify({
          total_pages: pages.length,
          pages,
        }),
      ]
    );

    await client.query("COMMIT");

    /* ============ CLEANUP ============ */
    fs.unlinkSync(pdfPath);
    imagePaths.forEach((p) => fs.unlinkSync(p));

    res.status(201).json({
      message: "Works berhasil dibuat",
      post_id: postId,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ERROR CREATE WORKS:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

/* =====================================================
   GET WORKS LIST (CARD READY + PREVIEW URL)
===================================================== */
exports.getWorksList = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.title,
        p.created_at,
        u.fullname AS author_name,
        c.name AS category,
        p.status,
        pf.meta
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN post_categories pc ON pc.post_id = p.id
      LEFT JOIN categories c ON c.id = pc.category_id
      LEFT JOIN post_files pf
        ON pf.post_id = p.id
       AND pf.file_type = 'application/pdf'
      WHERE p.type = 'works'
      ORDER BY p.created_at DESC
    `);

    const works = result.rows.map((row) => {
      const meta = row.meta || {};

      return {
        id: row.id,
        title: row.title,
        created_at: row.created_at,
        author_name: row.author_name,
        category: row.category,
        total_pages: meta.total_pages || 0,
        preview_page: meta.pages?.[0]
          ? toPublicUrl(meta.pages[0])
          : null,
        status: row.status,
      };
    });

    res.json(works);
  } catch (err) {
    console.error("ERROR GET WORKS LIST:", err);
    res.status(500).json({
      message: "Gagal mengambil daftar works",
    });
  }
};
