const path = require("path");

module.exports = (videoPath, outputDir, fileName) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = require("fluent-ffmpeg");
    const ffmpegPath = require("ffmpeg-static");
    const ffprobePath = require("ffprobe-static").path;

    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);

    ffmpeg(videoPath)
      .on("end", () => {
        resolve(path.join(outputDir, `${fileName}.jpg`));
      })
      .on("error", reject)
      .screenshots({
        timestamps: ["2"],
        filename: `${fileName}.jpg`,
        folder: outputDir,
        size: "640x360",
      });
  });
};
