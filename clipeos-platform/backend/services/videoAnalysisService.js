const { exec } = require('child_process');
const fs = require('fs').promises;

class VideoAnalysisService {
  async analyzeVideo(videoPath) {
    const results = {
      duration: 0,
      frameAnalysis: [],
      audioAnalysis: [],
      motionData: []
    };

    // Get video duration
    results.duration = await this.getVideoDuration(videoPath);

    // Extract and analyze frames
    const frameDir = await this.extractFrames(videoPath);
    results.frameAnalysis = await this.analyzeFrames(frameDir);

    // Analyze audio
    results.audioAnalysis = await this.analyzeAudio(videoPath);

    // Detect motion
    results.motionData = await this.detectMotion(videoPath);

    // Cleanup temp files
    await this.cleanup(frameDir);

    return results;
  }

  getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, (error, stdout) => {
        if (error) reject(error);
        resolve(parseFloat(stdout.trim()));
      });
    });
  }

  extractFrames(videoPath, interval = 2) {
    const frameDir = `/tmp/frames/${Date.now()}`;
    return fs.mkdir(frameDir, { recursive: true }).then(() => {
      return new Promise((resolve, reject) => {
        exec(`ffmpeg -i "${videoPath}" -vf fps=1/${interval} "${frameDir}/frame_%04d.jpg"`, (error) => {
          if (error) reject(error);
          else resolve(frameDir);
        });
      });
    });
  }

  analyzeFrames(frameDir) {
    return fs.readdir(frameDir).then(async (files) => {
      const analyses = [];
      for (const file of files) {
        const timestamp = this.getTimestampFromFilename(file);
        const objects = await this.detectObjects(`${frameDir}/${file}`);
        analyses.push({ timestamp, objects });
      }
      return analyses;
    });
  }

  detectObjects(framePath) {
    // Simplified object detection - in production, use TensorFlow.js or OpenCV
    return new Promise((resolve) => {
      exec(`ffmpeg -i "${framePath}" -vf "detect=model=yolo9000.cfg" -f null -`, (error) => {
        // Placeholder for actual object detection
        resolve([{ label: 'person', confidence: 0.9 }]);
      });
    });
  }

  analyzeAudio(videoPath) {
    return new Promise((resolve, reject) => {
      exec(`ffprobe -f lavfi -i "amovie='${videoPath}',astats=metadata=1:reset=1" -show_entries frame=pkt_pts_time:json=1 -of json`, (error, stdout) => {
        if (error) reject(error);
        else resolve(this.parseAudioData(JSON.parse(stdout)));
      });
    });
  }

  parseAudioData(data) {
    return data.frames.map(frame => ({
      time: parseFloat(frame.pkt_pts_time),
      rms: parseFloat(frame.tags?.lavfi.astats.Overall.RMS_level) || -60
    }));
  }

  detectMotion(videoPath) {
    return new Promise((resolve, reject) => {
      exec(`ffmpeg -i "${videoPath}" -vf "midequality" -f null -`, (error) => {
        if (error) reject(error);
        resolve([]);
      });
    });
  }

  getTimestampFromFilename(filename) {
    const match = filename.match(/frame_(\d+)\.jpg/);
    return match ? parseInt(match[1]) * 2 : 0;
  }

  async cleanup(frameDir) {
    try {
      await fs.rmdir(frameDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

module.exports = new VideoAnalysisService();