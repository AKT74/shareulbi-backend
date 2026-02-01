const supabase = require("../config/supabase");
const { v4: uuidv4 } = require("uuid");

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File wajib diupload" });
    }

    const file = req.file;
    const ext = file.originalname.split(".").pop();
    const fileName = `${uuidv4()}.${ext}`;

    const { error } = await supabase.storage
      .from("post-files")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("post-files")
      .getPublicUrl(fileName);

    res.json({
      file_url: data.publicUrl,
      file_type: file.mimetype,
      file_size: file.size,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
