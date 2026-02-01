const pool = require("../db");

/**
 * =========================
 * CREATE REPORT / FEEDBACK (USER)
 * =========================
 */
exports.createReportFeedback = async (req, res) => {
  const { topic_id, description, post_id } = req.body;
  const user_id = req.user.id;

  try {
    const result = await pool.query(
      `
      INSERT INTO reports_feedbacks
      (topic_id, description, user_id, post_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [topic_id, description, user_id, post_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * =========================
 * GET ALL REPORTS (ADMIN)
 * =========================
 */
exports.getAllReportsFeedbacks = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        rf.id,
        rf.description,
        rf.status,
        rf.created_at,
        u.fullname AS reporter,
        ft.name AS topic,
        p.title AS post_title
      FROM reports_feedbacks rf
      JOIN users u ON u.id = rf.user_id
      JOIN feedback_topics ft ON ft.id = rf.topic_id
      LEFT JOIN posts p ON p.id = rf.post_id
      ORDER BY rf.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * =========================
 * GET DETAIL REPORT
 * =========================
 */
exports.getReportFeedbackById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        rf.*,
        u.fullname AS reporter,
        ft.name AS topic
      FROM reports_feedbacks rf
      JOIN users u ON u.id = rf.user_id
      JOIN feedback_topics ft ON ft.id = rf.topic_id
      WHERE rf.id = $1
      `,
      [id]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: "Data tidak ditemukan" });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * =========================
 * UPDATE STATUS (ADMIN)
 * =========================
 */
exports.updateReportStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
        /* ini menggunakan fungsi update_report_status */
      `
      SELECT update_report_status($1, $2);   
      `,
        [id, status] // URUTAN BENAR
    );

    // ambil data terbaru (opsional tapi bagus)
    const updated = await pool.query(
      `
      SELECT *
      FROM reports_feedbacks
      WHERE id = $1
      `,
      [id]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: "Data tidak ditemukan" });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
