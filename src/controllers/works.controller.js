const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const supabase = require("../config/supabase");
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
   CREATE WORKS (UPLOAD PDF ONLY - FAST RESPONSE)
===================================================== */
exports.createWorks = async (req, res) => {
  const client = await pool.connect();

  try {
    const { title, description, category_id } = req.body;
    const userId = req.user.id;
    const file = req.file;

    /* ===== VALIDATION ===== */
    if (!title || title.length < 5)
      return res.status(400).json({ message: "Judul minimal 5 karakter" });

    if (!description || description.length < 5)
      return res.status(400).json({ message: "Deskripsi minimal 5 karakter" });

    if (!category_id)
      return res.status(400).json({ message: "Kategori wajib dipilih" });

    if (!file)
      return res.status(400).json({ message: "PDF wajib diupload" });

    const fileId = uuidv4();
    const pdfStoragePath = `works/${fileId}.pdf`;

    /* ===== UPLOAD PDF (CEPAT) ===== */
    await supabase.storage
      .from("post-files")
      .upload(pdfStoragePath, file.buffer, {
        contentType: "application/pdf",
      });

    /* ===== DB TRANSACTION ===== */
    await client.query("BEGIN");

    const postRes = await client.query(
      `
      INSERT INTO posts (title, description, type, status, user_id)
      VALUES ($1, $2, 'works', 'published', $3)
      RETURNING id
      `,
      [title, description, userId]
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
      INSERT INTO post_files (post_id, file_url, file_type, meta)
      VALUES ($1, $2, 'application/pdf', $3)
      `,
      [
        postId,
        pdfStoragePath,
        JSON.stringify({
          processing: true,
          total_pages: 0,
          pages: [],
        }),
      ]
    );

    await client.query("COMMIT");

    /* ===== BACKGROUND PROCESS (ASYNC) ===== */
    processPdfAsync(fileId, postId).catch(console.error);

    return res.status(201).json({
      message: "Works berhasil diupload, preview sedang diproses",
      post_id: postId,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE WORKS ERROR:", err);
    return res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

/* =====================================================
   BACKGROUND PDF → IMAGE (ASYNC)
===================================================== */
async function processPdfAsync(fileId, postId) {
  const tempDir = "tmp";
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  try {
    const pdfPath = path.join(tempDir, `${fileId}.pdf`);

    /* ===== DOWNLOAD PDF FROM SUPABASE ===== */
    const { data, error } = await supabase.storage
      .from("post-files")
      .download(`works/${fileId}.pdf`);

    if (error) throw error;

    fs.writeFileSync(pdfPath, Buffer.from(await data.arrayBuffer()));

    /* ===== CONVERT PDF → IMAGES ===== */
    const imagePaths = await convertPdfToImages(
      pdfPath,
      tempDir,
      `${fileId}_page`
    );

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

    /* ===== UPDATE META ===== */
    await pool.query(
      `
      UPDATE post_files
      SET meta = $1
      WHERE post_id = $2
      `,
      [
        JSON.stringify({
          processing: false,
          total_pages: pages.length,
          pages,
        }),
        postId,
      ]
    );

    /* ===== CLEANUP ===== */
    fs.unlinkSync(pdfPath);
    imagePaths.forEach((p) => fs.unlinkSync(p));
  } catch (err) {
    console.error("ASYNC PDF ERROR:", err);
  }
}

/* =====================================================
   GET WORKS LIST
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
        processing: meta.processing === true,
        status: row.status,
      };
    });

    res.json(works);
  } catch (err) {
    console.error("GET WORKS ERROR:", err);
    res.status(500).json({ message: "Gagal mengambil works" });
  }
};
