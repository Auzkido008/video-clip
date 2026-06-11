const express = require('express');
const router = express.Router();
const { clusterPoints } = require('../controllers/clipsController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadVideo } = require('./upload');

// Route to analyze video content and generate clustering suggestions
router.post('/analyze', authenticate, clusterPoints);

// Route to process video clustering (premium users only)
router.post('/generate-clusters', authenticate, authorize('premium'), (req, res) => {
  // This would normally trigger clustering job processing
  res.json({
    status: 'queued',
    message: 'Clustering job initiated',
    jobId: 'cluster-' + Date.now()
  });
});

// Route to upload video for processing
router.post('/upload', uploadVideo);

module.exports = router;