const ffmpeg = require("../config/ffmpeg");

module.exports = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const duration = Math.floor(metadata.format.duration);
      resolve(duration); // dalam detik
    });
  });
};
