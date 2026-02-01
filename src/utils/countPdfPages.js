const { PDFDocument } = require("pdf-lib")

/**
 * @param {Buffer} pdfBuffer
 * @returns {number} total halaman
 */
async function countPdfPages(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  return pdfDoc.getPageCount()
}

module.exports = countPdfPages
