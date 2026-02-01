module.exports = (videoPath) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = require("fluent-ffmpeg");
    const ffprobePath = require("ffprobe-static").path;

    ffmpeg.setFfprobePath(ffprobePath);

    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(Math.floor(metadata.format.duration));
    });
  });
};
