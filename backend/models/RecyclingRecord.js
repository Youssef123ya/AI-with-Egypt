const { CosmosClient } = require('@azure/cosmos');
const { v4: uuidv4 } = require('uuid');

class RecyclingRecord {
  constructor() {
    // Check if Azure Cosmos DB is properly configured
    if (!process.env.COSMOS_DB_ENDPOINT || process.env.COSMOS_DB_ENDPOINT === 'placeholder_cosmos_endpoint') {
      console.warn('Azure Cosmos DB not configured - using mock data mode for recycling records');
      this.mockMode = true;
      this.mockRecords = new Map();
      return;
    }
    
    try {
      this.client = new CosmosClient({
        endpoint: process.env.COSMOS_DB_ENDPOINT,
        key: process.env.COSMOS_DB_KEY
      });
      
      this.database = this.client.database(process.env.COSMOS_DB_DATABASE_NAME);
      this.container = this.database.container(process.env.COSMOS_DB_RECYCLING_CONTAINER);
      this.mockMode = false;
    } catch (error) {
      console.warn('Failed to initialize Cosmos DB client for recycling records - using mock data mode:', error.message);
      this.mockMode = true;
      this.mockRecords = new Map();
    }
  }

  // Environmental impact constants (CO2 saved in kg, energy saved in kWh per item)
  static getEnvironmentalImpact(category, subcategory) {
    const impactData = {
      'recyclable': {
        'plastic_bottles': { co2: 0.5, energy: 0.8, points: 10 },
        'glass': { co2: 0.3, energy: 0.6, points: 8 },
        'paper': { co2: 1.0, energy: 1.2, points: 12 },
        'cans': { co2: 1.5, energy: 2.0, points: 15 },
        'cardboard': { co2: 0.8, energy: 1.0, points: 10 }
      },
      'organic': {
        'food_scraps': { co2: 0.2, energy: 0.1, points: 5 },
        'yard_trimmings': { co2: 0.3, energy: 0.2, points: 6 },
        'coffee_tea_bags': { co2: 0.1, energy: 0.05, points: 3 },
        'egg_shells': { co2: 0.05, energy: 0.02, points: 2 },
        'kitchen_waste': { co2: 0.15, energy: 0.08, points: 4 }
      },
      'hazardous': {
        'batteries': { co2: 2.0, energy: 3.0, points: 25 },
        'e_waste': { co2: 5.0, energy: 8.0, points: 50 },
        'paints': { co2: 1.2, energy: 1.8, points: 20 },
        'pesticides': { co2: 1.5, energy: 2.2, points: 22 }
      },
      'non_recyclable': {
        'ceramic': { co2: 0, energy: 0, points: 0 },
        'diapers': { co2: 0, energy: 0, points: 0 },
        'plastic_bags': { co2: 0, energy: 0, points: 0 },
        'sanitary': { co2: 0, energy: 0, points: 0 },
        'styrofoam': { co2: 0, energy: 0, points: 0 }
      }
    };

    return impactData[category]?.[subcategory] || { co2: 0, energy: 0, points: 0 };
  }

  // Create a new recycling record
  async create(recordData) {
    try {
      const { 
        userId, 
        itemType, 
        category, 
        subcategory, 
        quantity = 1, 
        weight, 
        imageUrl, 
        location, 
        notes,
        classificationConfidence 
      } = recordData;

      // Calculate environmental impact
      const impact = RecyclingRecord.getEnvironmentalImpact(category, subcategory);
      const totalCO2Saved = impact.co2 * quantity;
      const totalEnergySaved = impact.energy * quantity;
      const pointsEarned = impact.points * quantity;

      const record = {
        id: uuidv4(),
        userId,
        itemType,
        category,
        subcategory,
        quantity,
        weight: weight || null,
        imageUrl: imageUrl || null,
        location: location || null,
        notes: notes || null,
        classificationConfidence: classificationConfidence || null,
        environmentalImpact: {
          co2Saved: totalCO2Saved,
          energySaved: totalEnergySaved,
          pointsEarned
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isVerified: false,
        recyclingMethod: null, // Will be populated based on item type and location
        recyclingCenter: null // Will be populated if user specifies where they recycled
      };

      if (this.mockMode) {
        // Mock mode - store in memory
        this.mockRecords.set(record.id, record);
        return record;
      }

      const { resource } = await this.container.items.create(record);
      return resource;
    } catch (error) {
      console.error('Error creating recycling record:', error);
      throw error;
    }
  }

  // Get recycling history for a user
  async getUserHistory(userId, limit = 50, offset = 0) {
    try {
      const querySpec = {
        query: `SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit`,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@offset', value: offset },
          { name: '@limit', value: limit }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      
      // Get total count for pagination
      const countQuery = {
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.userId = @userId',
        parameters: [
          { name: '@userId', value: userId }
        ]
      };
      const { resources: countResult } = await this.container.items.query(countQuery).fetchAll();
      const total = countResult[0] || 0;

      return {
        records: resources,
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + limit) < total
        }
      };
    } catch (error) {
      console.error('Error getting user recycling history:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStatistics(userId, period = 'all') {
    try {
      let dateFilter = '';
      const now = new Date();
      
      switch (period) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `AND c.createdAt >= '${weekAgo.toISOString()}'`;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `AND c.createdAt >= '${monthAgo.toISOString()}'`;
          break;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          dateFilter = `AND c.createdAt >= '${yearAgo.toISOString()}'`;
          break;
        default:
          dateFilter = '';
      }

      const querySpec = {
        query: `SELECT 
          COUNT(1) as totalItems,
          SUM(c.quantity) as totalQuantity,
          SUM(c.environmentalImpact.co2Saved) as totalCO2Saved,
          SUM(c.environmentalImpact.energySaved) as totalEnergySaved,
          SUM(c.environmentalImpact.pointsEarned) as totalPoints
        FROM c WHERE c.userId = @userId ${dateFilter}`,
        parameters: [
          { name: '@userId', value: userId }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      const stats = resources[0] || {
        totalItems: 0,
        totalQuantity: 0,
        totalCO2Saved: 0,
        totalEnergySaved: 0,
        totalPoints: 0
      };

      // Get category breakdown
      const categoryQuery = {
        query: `SELECT 
          c.category,
          COUNT(1) as count,
          SUM(c.quantity) as quantity,
          SUM(c.environmentalImpact.co2Saved) as co2Saved,
          SUM(c.environmentalImpact.energySaved) as energySaved,
          SUM(c.environmentalImpact.pointsEarned) as points
        FROM c WHERE c.userId = @userId ${dateFilter}
        GROUP BY c.category`,
        parameters: [
          { name: '@userId', value: userId }
        ]
      };

      const { resources: categoryBreakdown } = await this.container.items.query(categoryQuery).fetchAll();

      return {
        ...stats,
        categoryBreakdown,
        period
      };
    } catch (error) {
      console.error('Error getting user statistics:', error);
      throw error;
    }
  }

  // Get global statistics (community impact)
  async getGlobalStatistics(period = 'all') {
    try {
      let dateFilter = '';
      const now = new Date();
      
      switch (period) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `WHERE c.createdAt >= '${weekAgo.toISOString()}'`;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `WHERE c.createdAt >= '${monthAgo.toISOString()}'`;
          break;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          dateFilter = `WHERE c.createdAt >= '${yearAgo.toISOString()}'`;
          break;
        default:
          dateFilter = '';
      }

      const querySpec = {
        query: `SELECT 
          COUNT(1) as totalItems,
          COUNT(DISTINCT c.userId) as totalUsers,
          SUM(c.quantity) as totalQuantity,
          SUM(c.environmentalImpact.co2Saved) as totalCO2Saved,
          SUM(c.environmentalImpact.energySaved) as totalEnergySaved,
          SUM(c.environmentalImpact.pointsEarned) as totalPoints
        FROM c ${dateFilter}`,
        parameters: []
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      return resources[0] || {
        totalItems: 0,
        totalUsers: 0,
        totalQuantity: 0,
        totalCO2Saved: 0,
        totalEnergySaved: 0,
        totalPoints: 0
      };
    } catch (error) {
      console.error('Error getting global statistics:', error);
      throw error;
    }
  }

  // Update recycling record
  async update(recordId, userId, updateData) {
    try {
      const record = await this.container.item(recordId, recordId).read();
      if (!record.resource) {
        throw new Error('Recycling record not found');
      }

      // Verify user owns this record
      if (record.resource.userId !== userId) {
        throw new Error('Unauthorized to update this record');
      }

      const updatedRecord = {
        ...record.resource,
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      // Recalculate environmental impact if quantity or type changed
      if (updateData.quantity || updateData.category || updateData.subcategory) {
        const impact = RecyclingRecord.getEnvironmentalImpact(
          updatedRecord.category, 
          updatedRecord.subcategory
        );
        updatedRecord.environmentalImpact = {
          co2Saved: impact.co2 * updatedRecord.quantity,
          energySaved: impact.energy * updatedRecord.quantity,
          pointsEarned: impact.points * updatedRecord.quantity
        };
      }

      const { resource } = await this.container.item(recordId, recordId).replace(updatedRecord);
      return resource;
    } catch (error) {
      console.error('Error updating recycling record:', error);
      throw error;
    }
  }

  // Delete recycling record
  async delete(recordId, userId) {
    try {
      const record = await this.container.item(recordId, recordId).read();
      if (!record.resource) {
        throw new Error('Recycling record not found');
      }

      // Verify user owns this record
      if (record.resource.userId !== userId) {
        throw new Error('Unauthorized to delete this record');
      }

      await this.container.item(recordId, recordId).delete();
      return { message: 'Recycling record deleted successfully' };
    } catch (error) {
      console.error('Error deleting recycling record:', error);
      throw error;
    }
  }

  // Get recycling trends over time
  async getTrends(userId, period = 'month', groupBy = 'day') {
    try {
      const now = new Date();
      let dateFilter = '';
      let groupByFormat = '';

      switch (period) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `AND c.createdAt >= '${weekAgo.toISOString()}'`;
          groupByFormat = 'SUBSTRING(c.createdAt, 0, 10)'; // YYYY-MM-DD
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `AND c.createdAt >= '${monthAgo.toISOString()}'`;
          groupByFormat = 'SUBSTRING(c.createdAt, 0, 10)'; // YYYY-MM-DD
          break;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          dateFilter = `AND c.createdAt >= '${yearAgo.toISOString()}'`;
          groupByFormat = 'SUBSTRING(c.createdAt, 0, 7)'; // YYYY-MM
          break;
        default:
          groupByFormat = 'SUBSTRING(c.createdAt, 0, 10)';
      }

      const querySpec = {
        query: `SELECT 
          ${groupByFormat} as period,
          COUNT(1) as count,
          SUM(c.quantity) as quantity,
          SUM(c.environmentalImpact.co2Saved) as co2Saved,
          SUM(c.environmentalImpact.energySaved) as energySaved
        FROM c WHERE c.userId = @userId ${dateFilter}
        GROUP BY ${groupByFormat}
        ORDER BY ${groupByFormat}`,
        parameters: [
          { name: '@userId', value: userId }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      return resources;
    } catch (error) {
      console.error('Error getting recycling trends:', error);
      throw error;
    }
  }
}

module.exports = new RecyclingRecord();