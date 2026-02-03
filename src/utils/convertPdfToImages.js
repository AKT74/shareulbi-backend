const path = require("path");
const fs = require("fs");

module.exports = async function convertPdfToImages(
  pdfPath,
  outputDir,
  filePrefix,
  maxPages = 3 // 🔥 BATASI PAGE (WAJIB)
) {
  const pdf = require("pdf-poppler");

  const options = {
    format: "png",
    out_dir: outputDir,
    out_prefix: filePrefix,
    page: null, // convert all dulu
  };

  // 🔥 CONVERT
  await pdf.convert(pdfPath, options);

  // 🔥 AMBIL FILE TERBATAS
  const files = fs
    .readdirSync(outputDir)
    .filter(
      (f) =>
        f.startsWith(filePrefix) &&
        f.endsWith(".png")
    )
    .sort()
    .slice(0, maxPages); // ⬅️ PENTING

  return files.map((f) => path.join(outputDir, f));
};
