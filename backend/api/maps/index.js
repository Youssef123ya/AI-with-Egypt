const express = require('express');
const axios = require('axios');
const Joi = require('joi');
const { optionalAuthMiddleware } = require('../../middleware/auth');

const router = express.Router();

// Validation schemas
const searchRecyclingCentersSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().min(1).max(50).default(10), // radius in km
  category: Joi.string().valid('all', 'plastic', 'glass', 'paper', 'metal', 'electronic', 'hazardous').default('all'),
  limit: Joi.number().min(1).max(50).default(20)
});

const geocodeSchema = Joi.object({
  address: Joi.string().min(3).max(200).required(),
  countrySet: Joi.string().length(2).default('US') // ISO 3166-1 alpha-2 country code
});

// Mock recycling center data (in production, this would come from Azure Maps or a database)
const mockRecyclingCenters = [
  {
    id: '1',
    name: 'Green Earth Recycling Center',
    address: '123 Main St, Anytown, ST 12345',
    phone: '(555) 123-4567',
    coordinates: { latitude: 40.7589, longitude: -73.9851 },
    acceptedMaterials: ['plastic', 'glass', 'paper', 'metal'],
    hours: 'Mon-Fri: 8AM-6PM, Sat: 9AM-4PM, Sun: Closed',
    website: 'https://greenearthrecycling.com',
    rating: 4.5,
    distance: 2.3
  },
  {
    id: '2',
    name: 'City Recycling Depot',
    address: '456 Oak Ave, Anytown, ST 12345',
    phone: '(555) 234-5678',
    coordinates: { latitude: 40.7505, longitude: -73.9934 },
    acceptedMaterials: ['plastic', 'glass', 'paper', 'metal', 'electronic'],
    hours: 'Mon-Sat: 7AM-7PM, Sun: 10AM-5PM',
    website: 'https://cityrecycling.gov',
    rating: 4.2,
    distance: 3.1
  },
  {
    id: '3',
    name: 'EcoWaste Solutions',
    address: '789 Pine St, Anytown, ST 12345',
    phone: '(555) 345-6789',
    coordinates: { latitude: 40.7614, longitude: -73.9776 },
    acceptedMaterials: ['hazardous', 'electronic', 'battery'],
    hours: 'Tue-Thu: 10AM-4PM, Sat: 9AM-2PM',
    website: 'https://ecowastesolutions.org',
    rating: 4.8,
    distance: 1.8
  }
];

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to search for recycling centers using Azure Maps
async function searchWithAzureMaps(latitude, longitude, radius, category = 'all') {
  try {
    if (!process.env.AZURE_MAPS_SUBSCRIPTION_KEY) {
      throw new Error('Azure Maps subscription key not configured');
    }

    // Build search query based on category
    let query = 'recycling center';
    if (category !== 'all') {
      query += ` ${category}`;
    }

    const params = {
      'api-version': '1.0',
      'subscription-key': process.env.AZURE_MAPS_SUBSCRIPTION_KEY,
      query,
      lat: latitude,
      lon: longitude,
      radius: radius * 1000, // Convert km to meters
      limit: 20,
      categorySet: '9361' // POI category for recycling centers
    };

    const response = await axios.get('https://atlas.microsoft.com/search/nearby/json', {
      params,
      timeout: 10000
    });

    if (!response.data || !response.data.results) {
      return [];
    }

    // Transform Azure Maps results to our format
    return response.data.results.map(result => ({
      id: result.id || `azure-${Math.random().toString(36).substr(2, 9)}`,
      name: result.poi?.name || 'Recycling Center',
      address: result.address?.freeformAddress || 'Address not available',
      phone: result.poi?.phone || null,
      coordinates: {
        latitude: result.position?.lat || 0,
        longitude: result.position?.lon || 0
      },
      acceptedMaterials: category === 'all' ? ['plastic', 'glass', 'paper', 'metal'] : [category],
      hours: result.poi?.openingHours?.timeRanges?.[0]?.startTime ? 
        `Hours: ${result.poi.openingHours.timeRanges[0].startTime} - ${result.poi.openingHours.timeRanges[0].endTime}` : 
        'Hours not available',
      website: result.poi?.url || null,
      rating: null,
      distance: calculateDistance(
        latitude, 
        longitude, 
        result.position?.lat || 0, 
        result.position?.lon || 0
      )
    }));
  } catch (error) {
    console.error('Azure Maps search error:', error);
    throw error;
  }
}

// @route   GET /api/maps/recycling-centers
// @desc    Find nearby recycling centers
// @access  Public
router.get('/recycling-centers', optionalAuthMiddleware, async (req, res) => {
  try {
    // Validate query parameters
    const { error, value } = searchRecyclingCentersSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { latitude, longitude, radius, category, limit } = value;

    let centers = [];

    // Try to use Azure Maps first
    try {
      centers = await searchWithAzureMaps(latitude, longitude, radius, category);
    } catch (azureError) {
      console.warn('Azure Maps search failed, falling back to mock data:', azureError.message);
      
      // Fallback to mock data
      centers = mockRecyclingCenters
        .map(center => ({
          ...center,
          distance: calculateDistance(
            latitude,
            longitude,
            center.coordinates.latitude,
            center.coordinates.longitude
          )
        }))
        .filter(center => {
          // Filter by radius
          if (center.distance > radius) return false;
          
          // Filter by category
          if (category !== 'all' && !center.acceptedMaterials.includes(category)) {
            return false;
          }
          
          return true;
        });
    }

    // Sort by distance and apply limit
    centers = centers
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    // Add additional metadata
    const response = {
      success: true,
      data: {
        centers,
        searchParams: {
          location: { latitude, longitude },
          radius,
          category,
          limit
        },
        metadata: {
          total: centers.length,
          maxRadius: radius,
          searchTimestamp: new Date().toISOString()
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Search recycling centers error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to search for recycling centers'
    });
  }
});

// @route   GET /api/maps/geocode
// @desc    Geocode an address to coordinates
// @access  Public
router.get('/geocode', async (req, res) => {
  try {
    // Validate query parameters
    const { error, value } = geocodeSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { address, countrySet } = value;

    if (!process.env.AZURE_MAPS_SUBSCRIPTION_KEY) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Geocoding service is not configured'
      });
    }

    const params = {
      'api-version': '1.0',
      'subscription-key': process.env.AZURE_MAPS_SUBSCRIPTION_KEY,
      query: address,
      countrySet,
      limit: 5
    };

    const response = await axios.get('https://atlas.microsoft.com/search/address/json', {
      params,
      timeout: 10000
    });

    if (!response.data || !response.data.results || response.data.results.length === 0) {
      return res.status(404).json({
        error: 'Address Not Found',
        message: 'No results found for the specified address'
      });
    }

    // Transform results
    const results = response.data.results.map(result => ({
      address: result.address?.freeformAddress || address,
      coordinates: {
        latitude: result.position?.lat || 0,
        longitude: result.position?.lon || 0
      },
      confidence: result.score || 0,
      type: result.type || 'Unknown',
      viewport: result.viewport ? {
        topLeft: {
          latitude: result.viewport.topLeftPoint?.lat || 0,
          longitude: result.viewport.topLeftPoint?.lon || 0
        },
        bottomRight: {
          latitude: result.viewport.btmRightPoint?.lat || 0,
          longitude: result.viewport.btmRightPoint?.lon || 0
        }
      } : null
    }));

    res.json({
      success: true,
      data: {
        query: address,
        results
      }
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Azure Maps subscription key'
      });
    }
    
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please try again later.'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to geocode address'
    });
  }
});

// @route   GET /api/maps/reverse-geocode
// @desc    Reverse geocode coordinates to address
// @access  Public
router.get('/reverse-geocode', async (req, res) => {
  try {
    const latitude = parseFloat(req.query.latitude);
    const longitude = parseFloat(req.query.longitude);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid Coordinates',
        message: 'Valid latitude and longitude are required'
      });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        error: 'Invalid Coordinates',
        message: 'Latitude must be between -90 and 90, longitude between -180 and 180'
      });
    }

    if (!process.env.AZURE_MAPS_SUBSCRIPTION_KEY) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Reverse geocoding service is not configured'
      });
    }

    const params = {
      'api-version': '1.0',
      'subscription-key': process.env.AZURE_MAPS_SUBSCRIPTION_KEY,
      query: `${latitude},${longitude}`
    };

    const response = await axios.get('https://atlas.microsoft.com/search/address/reverse/json', {
      params,
      timeout: 10000
    });

    if (!response.data || !response.data.addresses || response.data.addresses.length === 0) {
      return res.status(404).json({
        error: 'Address Not Found',
        message: 'No address found for the specified coordinates'
      });
    }

    const address = response.data.addresses[0];

    res.json({
      success: true,
      data: {
        coordinates: { latitude, longitude },
        address: {
          formatted: address.address?.freeformAddress || 'Address not available',
          street: address.address?.streetName || null,
          city: address.address?.municipality || null,
          state: address.address?.countrySubdivision || null,
          country: address.address?.country || null,
          postalCode: address.address?.postalCode || null
        }
      }
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Azure Maps subscription key'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reverse geocode coordinates'
    });
  }
});

// @route   GET /api/maps/route
// @desc    Get route directions between two points
// @access  Public
router.get('/route', async (req, res) => {
  try {
    const startLat = parseFloat(req.query.startLatitude);
    const startLon = parseFloat(req.query.startLongitude);
    const endLat = parseFloat(req.query.endLatitude);
    const endLon = parseFloat(req.query.endLongitude);

    if (isNaN(startLat) || isNaN(startLon) || isNaN(endLat) || isNaN(endLon)) {
      return res.status(400).json({
        error: 'Invalid Coordinates',
        message: 'Valid start and end coordinates are required'
      });
    }

    if (!process.env.AZURE_MAPS_SUBSCRIPTION_KEY) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Route service is not configured'
      });
    }

    const params = {
      'api-version': '1.0',
      'subscription-key': process.env.AZURE_MAPS_SUBSCRIPTION_KEY,
      query: `${startLat},${startLon}:${endLat},${endLon}`,
      travelMode: req.query.travelMode || 'car',
      traffic: 'true'
    };

    const response = await axios.get('https://atlas.microsoft.com/route/directions/json', {
      params,
      timeout: 15000
    });

    if (!response.data || !response.data.routes || response.data.routes.length === 0) {
      return res.status(404).json({
        error: 'Route Not Found',
        message: 'No route found between the specified points'
      });
    }

    const route = response.data.routes[0];
    const summary = route.summary;

    res.json({
      success: true,
      data: {
        route: {
          distance: Math.round(summary.lengthInMeters / 1000 * 100) / 100, // km
          duration: Math.round(summary.travelTimeInSeconds / 60), // minutes
          trafficDelay: summary.trafficDelayInSeconds || 0,
          geometry: route.legs?.[0]?.points || []
        },
        start: { latitude: startLat, longitude: startLon },
        end: { latitude: endLat, longitude: endLon }
      }
    });
  } catch (error) {
    console.error('Route calculation error:', error);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Azure Maps subscription key'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to calculate route'
    });
  }
});

module.exports = router;