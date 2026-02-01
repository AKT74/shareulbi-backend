const multer = require("multer")

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // max global (video)
  fileFilter: (req, file, cb) => {
    const allowed = [
      "video/mp4",
      "application/pdf"
    ]

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Format file tidak didukung"))
    }

    cb(null, true)
  },
})

module.exports = upload
