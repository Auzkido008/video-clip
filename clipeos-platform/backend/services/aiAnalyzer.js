const tf = require('@tensorflow/tfjs');
const cocoSsd = require('@tensorflow-models/coco-ssd');
const fs = require('fs');
const { exec } = require('child_process');

class AIAnalyzer {
  constructor() {
    this.model = null;
    this.isLoaded = false;
  }

  async loadModel() {
    if (!this.isLoaded) {
      // Use COCO-SSD for object detection
      this.model = await cocoSsd.load();
      this.isLoaded = true;
    }
  }

  // Extract frames at intervals for analysis
  async extractFrames(videoPath, interval = 2) {
    const outputDir = `/tmp/frames/${Date.now()}`;
    await fs.promises.mkdir(outputDir, { recursive: true });

    return new Promise((resolve, reject) => {
      exec(
        `ffmpeg -i "${videoPath}" -vf fps=1/${interval} "${outputDir}/frame_%04d.jpg"`,
        (error) => {
          if (error) reject(error);
          else resolve(outputDir);
        }
      );
    });
  }

  // Analyze a single frame for objects and motion
  async analyzeFrame(framePath) {
    await this.loadModel();
    const predictions = await this.model.detect(framePath);
    return predictions.map(p => ({
      label: p.class,
      score: p.score,
      bbox: p.bbox
    }));
  }

  // Extract audio and analyze levels
  async analyzeAudio(videoPath) {
    const audioPath = `/tmp/audio/${Date.now()}.wav`;

    return new Promise((resolve, reject) => {
      exec(
        `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "${audioPath}"`,
        (error) => {
          if (error) reject(error);

          // Use ffprobe to get audio levels
          exec(
            `ffprobe -f lavfi -i "amovie='${audioPath}',astats=metadata=1:reset=1" -show_entries frame=pkt_pts_time:json=1`,
            (err, stdout) => {
              if (err) reject(err);
              resolve(this.parseAudioLevels(JSON.parse(stdout)));
            }
          );
        }
      );
    });
  }

  // Parse audio loudness data
  parseAudioLevels(data) {
    const levels = data.frames.map(f => ({
      time: parseFloat(f.pkt_pts_time),
      rms: parseFloat(f.tags?.lavfi.astats.Overall.RMS_level) || -60
    }));
    return levels;
  }

  // Main analysis function
  async analyzeVideo(videoPath) {
    await this.loadModel();

    // Extract frames at 2-second intervals
    const framesDir = await this.extractFrames(videoPath);
    const frames = await fs.promises.readdir(framesDir);

    // Analyze each frame
    const frameAnalyses = await Promise.all(
      frames.map(async frame => {
        const framePath = `${framesDir}/${frame}`;
        const timestamp = this.getTimestampFromFilename(frame);
        const objects = await this.analyzeFrame(framePath);
        return { timestamp, objects };
      })
    );

    // Analyze audio
    const audioLevels = await this.analyzeAudio(videoPath);

    return {
      frameAnalyses,
      audioLevels,
      videoPath
    };
  }

  // Parse frame filename to get timestamp
  getTimestampFromFilename(filename) {
    const match = filename.match(/frame_(\d+)\.jpg/);
    const frameNum = parseInt(match[1]);
    return frameNum * 2; // Assuming 2-second intervals
  }
}

module.exports = { analyzeVideo: (path) => new AIAnalyzer().analyzeVideo(path) };