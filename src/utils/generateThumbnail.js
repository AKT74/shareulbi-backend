const ffmpeg = require("../config/ffmpeg");
const path = require("path");

module.exports = (videoPath, outputDir, fileName) => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .on("end", () => {
        resolve(path.join(outputDir, `${fileName}.jpg`));
      })
      .on("error", reject)
      .screenshots({
        timestamps: ["2"], // ambil frame detik ke-2
        filename: `${fileName}.jpg`,
        folder: outputDir,
        size: "640x360",
      });
  });
};
