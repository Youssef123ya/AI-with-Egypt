const express = require('express');
const multer = require('multer');
const Joi = require('joi');
// Azure imports will be dynamically loaded if available
let BlobServiceClient, PredictionAPIClient, CognitiveServicesCredentials;
const RecyclingRecord = require('../../models/RecyclingRecord');
const User = require('../../models/User');
const { authMiddleware, optionalAuthMiddleware } = require('../../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

// Initialize Azure services (mock mode for development)
let blobServiceClient = null;
let predictionClient = null;
let mockMode = true;

console.log('Azure Custom Vision not configured - using mock classification mode');

// Validation schemas
const classifySchema = Joi.object({
  returnConfidence: Joi.boolean().default(true)
});

const logRecyclingSchema = Joi.object({
  itemType: Joi.string().required(),
  category: Joi.string().valid('recyclable', 'organic', 'hazardous', 'non_recyclable').required(),
  subcategory: Joi.string().required(),
  quantity: Joi.number().integer().min(1).default(1),
  weight: Joi.number().positive().optional(),
  notes: Joi.string().max(500).optional(),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    address: Joi.string().max(200)
  }).optional(),
  imageUrl: Joi.string().uri().optional(),
  classificationConfidence: Joi.number().min(0).max(1).optional()
});

// Helper function to upload image (mock implementation)
async function uploadImageToBlob(buffer, filename, contentType) {
  try {
    // Mock image storage - return a placeholder URL
    const mockImageUrl = `https://mock-storage.example.com/images/${Date.now()}-${filename}`;
    
    console.log(`Mock: Would upload ${filename} (${contentType}) to blob storage`);
    
    return mockImageUrl;
  } catch (error) {
    console.error('Error in mock image upload:', error);
    throw error;
  }
}

// Helper function to classify image (mock implementation for demo)
async function classifyImageWithCustomVision(imageBuffer) {
  try {
    // Mock classification for demonstration
    const mockPredictions = [
      { 
        itemType: 'Plastic Bottle',
        category: 'recyclable', 
        subcategory: 'plastic_bottles',
        confidence: 0.87
      },
      { 
        itemType: 'Aluminum Can',
        category: 'recyclable', 
        subcategory: 'cans',
        confidence: 0.82
      },
      { 
        itemType: 'Glass Bottle',
        category: 'recyclable', 
        subcategory: 'glass',
        confidence: 0.79
      }
    ];

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return random prediction from mock data
    const prediction = mockPredictions[Math.floor(Math.random() * mockPredictions.length)];
    
    return {
      success: true,
      itemType: prediction.itemType,
      category: prediction.category,
      subcategory: prediction.subcategory,
      confidence: prediction.confidence,
      allPredictions: mockPredictions
    };
  } catch (error) {
    console.error('Error in mock classification:', error);
    throw error;
  }
}

// @route   POST /api/recycling/classify
// @desc    Classify waste image using AI
// @access  Public (but better with auth for tracking)
router.post('/classify', optionalAuthMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No Image Provided',
        message: 'Please upload an image file'
      });
    }

    // Validate query parameters
    const { error, value } = classifySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }

    // Upload image to blob storage first
    let imageUrl = null;
    try {
      imageUrl = await uploadImageToBlob(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
    } catch (uploadError) {
      console.error('Image upload failed:', uploadError);
      // Continue with classification even if upload fails
    }

    // Classify image
    const classification = await classifyImageWithCustomVision(req.file.buffer);

    const response = {
      success: classification.success,
      message: classification.message || 'Image classified successfully',
      data: {
        imageUrl,
        classification: {
          itemType: classification.itemType,
          category: classification.category,
          subcategory: classification.subcategory,
          confidence: classification.confidence
        }
      }
    };

    // Include detailed predictions if requested and available
    if (value.returnConfidence && classification.allPredictions) {
      response.data.allPredictions = classification.allPredictions;
    }

    // If classification failed, include alternative predictions
    if (!classification.success && classification.predictions) {
      response.data.alternativePredictions = classification.predictions;
    }

    res.json(response);
  } catch (error) {
    console.error('Classification error:', error);
    
    if (error.message.includes('Custom Vision not configured')) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Image classification service is currently unavailable'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to classify image'
    });
  }
});

// @route   POST /api/recycling/log
// @desc    Log a recycling entry
// @access  Private
router.post('/log', authMiddleware, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = logRecyclingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }

    // Create recycling record
    const record = await RecyclingRecord.create({
      ...value,
      userId: req.user.userId
    });

    // Update user statistics
    await User.updateStatistics(req.user.userId, {
      totalItemsRecycled: record.quantity,
      totalCO2Saved: record.environmentalImpact.co2Saved,
      totalEnergySaved: record.environmentalImpact.energySaved,
      lastRecyclingDate: record.createdAt
    });

    res.status(201).json({
      success: true,
      message: 'Recycling entry logged successfully',
      data: { record }
    });
  } catch (error) {
    console.error('Log recycling error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to log recycling entry'
    });
  }
});

// @route   GET /api/recycling/history
// @desc    Get user's recycling history
// @access  Private
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await RecyclingRecord.getUserHistory(req.user.userId, limit, offset);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get recycling history'
    });
  }
});

// @route   GET /api/recycling/statistics
// @desc    Get user's recycling statistics
// @access  Private
router.get('/statistics', authMiddleware, async (req, res) => {
  try {
    const period = req.query.period || 'all';
    const validPeriods = ['week', 'month', 'year', 'all'];
    
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        error: 'Invalid Period',
        message: 'Period must be one of: week, month, year, all'
      });
    }

    const statistics = await RecyclingRecord.getUserStatistics(req.user.userId, period);

    res.json({
      success: true,
      data: { statistics }
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get recycling statistics'
    });
  }
});

// @route   GET /api/recycling/global-stats
// @desc    Get global recycling statistics
// @access  Public
router.get('/global-stats', async (req, res) => {
  try {
    const period = req.query.period || 'all';
    const validPeriods = ['week', 'month', 'year', 'all'];
    
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        error: 'Invalid Period',
        message: 'Period must be one of: week, month, year, all'
      });
    }

    const statistics = await RecyclingRecord.getGlobalStatistics(period);

    res.json({
      success: true,
      data: { statistics }
    });
  } catch (error) {
    console.error('Get global statistics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get global statistics'
    });
  }
});

// @route   GET /api/recycling/trends
// @desc    Get recycling trends over time
// @access  Private
router.get('/trends', authMiddleware, async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const groupBy = req.query.groupBy || 'day';
    
    const validPeriods = ['week', 'month', 'year'];
    const validGroupBy = ['day', 'week', 'month'];
    
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        error: 'Invalid Period',
        message: 'Period must be one of: week, month, year'
      });
    }
    
    if (!validGroupBy.includes(groupBy)) {
      return res.status(400).json({
        error: 'Invalid Group By',
        message: 'Group by must be one of: day, week, month'
      });
    }

    const trends = await RecyclingRecord.getTrends(req.user.userId, period, groupBy);

    res.json({
      success: true,
      data: { trends }
    });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get recycling trends'
    });
  }
});

// @route   PUT /api/recycling/:id
// @desc    Update a recycling record
// @access  Private
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { error, value } = logRecyclingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }

    const updatedRecord = await RecyclingRecord.update(req.params.id, req.user.userId, value);

    res.json({
      success: true,
      message: 'Recycling record updated successfully',
      data: { record: updatedRecord }
    });
  } catch (error) {
    console.error('Update recycling record error:', error);
    
    if (error.message === 'Recycling record not found') {
      return res.status(404).json({
        error: 'Record Not Found',
        message: 'Recycling record not found'
      });
    }
    
    if (error.message === 'Unauthorized to update this record') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to update this record'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update recycling record'
    });
  }
});

// @route   DELETE /api/recycling/:id
// @desc    Delete a recycling record
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await RecyclingRecord.delete(req.params.id, req.user.userId);

    res.json({
      success: true,
      message: 'Recycling record deleted successfully'
    });
  } catch (error) {
    console.error('Delete recycling record error:', error);
    
    if (error.message === 'Recycling record not found') {
      return res.status(404).json({
        error: 'Record Not Found',
        message: 'Recycling record not found'
      });
    }
    
    if (error.message === 'Unauthorized to delete this record') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to delete this record'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete recycling record'
    });
  }
});

module.exports = router;