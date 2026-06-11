const { analyzeVideo } = require('../services/aiAnalyzer');

// Analyze video and generate clip suggestions
const clusterPoints = async (req, res) => {
  try {
    const { videoPath } = req.body;

    // Analyze video content
    const analysis = await analyzeVideo(videoPath);

    // Generate clustering algorithm parameters
    const clusters = await createClustersFromAnalysis(analysis);

    // Process each cluster for optimal clip points
    const clipPoints = await processClusters(clusters);

    res.json({
      success: true,
      clipSuggestions: clipPoints.map(point => ({
        startTime: point.start,
        endTime: point.end,
        contentType: point.type, // 'visual' | 'audio' | 'both'
        engagementScore: point.score
      }))
    });
  } catch (error) {
    console.error('Clustering failed:', error);
    res.status(500).json({ error: 'Clustering failed' });
  }
};

// Create clusters from analysis data
async function createClustersFromAnalysis(analysis) {
  const clusters = [];

  // Cluster by visual content
  const visualClusters = analysis.frameAnalyses.reduce((acc, frame) => {
    const minute = Math.floor(frame.timestamp / 60);
    if (!acc[minute]) acc[minute] = [];
    acc[minute].push(frame);
    return acc;
  }, {});

  // Cluster by audio activity
  const audioClusters = analysis.audioLevels.reduce((acc, level) => {
    const minute = Math.floor(level.time / 60);
    if (!acc[minute]) acc[minute] = [];
    acc[minute].push(level);
    return acc;
  }, {});

  // Combine clusters
  Object.keys(visualClusters).forEach(minute => {
    clusters.push({
      minute: parseInt(minute),
      visual: visualClusters[minute],
      audio: audioClusters[minute] || []
    });
  });

  return clusters;
}

// Process clusters to find optimal clip points
async function processClusters(clusters) {
  const clipPoints = [];

  for (const cluster of clusters) {
    // Score each cluster based on visual and audio activity
    const visualScore = calculateVisualScore(cluster.visual);
    const audioScore = calculateAudioScore(cluster.audio);
    const combinedScore = visualScore * 0.6 + audioScore * 0.4;

    // Only include high-scoring clusters
    if (combinedScore > 0.7) {
      clipPoints.push({
        start: cluster.minute * 60,
        end: (cluster.minute + 1) * 60,
        type: combinedScore > 0.8 ? 'both' : visualScore > audioScore ? 'visual' : 'audio',
        score: combinedScore
      });
    }
  }

  return clipPoints.sort((a, b) => b.score - a.score).slice(0, 10);
}

// Calculate visual score based on object detection
function calculateVisualScore(frames) {
  if (!frames.length) return 0;

  const objectCount = frames.reduce((sum, frame) => sum + frame.objects.length, 0);
  const motionScore = calculateMotionScore(frames);
  const objectScore = Math.min(objectCount / (frames.length * 3), 1);

  return (motionScore * 0.6) + (objectScore * 0.4);
}

// Calculate motion score based on object movement
function calculateMotionScore(frames) {
  if (frames.length < 2) return 0;

  let totalMovement = 0;
  for (let i = 1; i < frames.length; i++) {
    const prevObjects = frames[i-1].objects;
    const currObjects = frames[i].objects;

    // Simple motion detection based on object count changes
    totalMovement += Math.abs(prevObjects.length - currObjects.length);
  }

  return Math.min(totalMovement / frames.length, 1);
}

// Calculate audio score based on loudness patterns
function calculateAudioScore(levels) {
  if (!levels.length) return 0;

  const avgLoudness = levels.reduce((sum, level) => sum + Math.abs(level.rms), 0) / levels.length;
  const normalizedLoudness = Math.min(avgLoudness / 60, 1);

  // Penalize silence
  const silenceCount = levels.filter(level => level.rms < -45).length;
  const silencePenalty = silenceCount / levels.length;

  return Math.max(0, normalizedLoudness - silencePenalty);
}

module.exports = { clusterPoints };