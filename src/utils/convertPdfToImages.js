const path = require("path");
const fs = require("fs");

module.exports = async function convertPdfToImages(
  pdfPath,
  outputDir,
  fileId
) {
  // 🔥 LAZY IMPORT
  const pdf = require("pdf-poppler");

  const options = {
    format: "png",
    out_dir: outputDir,
    out_prefix: fileId,
    page: null, // ALL pages
  };

  await pdf.convert(pdfPath, options);

  const files = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith(fileId) && f.endsWith(".png"))
    .sort();

  return files.map((f) => path.join(outputDir, f));
};
