const { CosmosClient } = require('@azure/cosmos');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

class User {
  constructor() {
    // Check if Azure Cosmos DB is properly configured
    if (!process.env.COSMOS_DB_ENDPOINT || process.env.COSMOS_DB_ENDPOINT === 'placeholder_cosmos_endpoint') {
      console.warn('Azure Cosmos DB not configured - using mock data mode');
      this.mockMode = true;
      this.mockUsers = new Map();
      return;
    }
    
    try {
      this.client = new CosmosClient({
        endpoint: process.env.COSMOS_DB_ENDPOINT,
        key: process.env.COSMOS_DB_KEY
      });
      
      this.database = this.client.database(process.env.COSMOS_DB_DATABASE_NAME);
      this.container = this.database.container(process.env.COSMOS_DB_USERS_CONTAINER);
      this.mockMode = false;
    } catch (error) {
      console.warn('Failed to initialize Cosmos DB client - using mock data mode:', error.message);
      this.mockMode = true;
      this.mockUsers = new Map();
    }
  }

  // Create a new user
  async create(userData) {
    try {
      const { email, password, name, location } = userData;
      
      // Check if user already exists
      const existingUser = await this.findByEmail(email);
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const user = {
        id: uuidv4(),
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        location,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        totalRecyclingEntries: 0,
        totalPointsEarned: 0,
        badges: [],
        preferences: {
          notifications: true,
          emailUpdates: true,
          units: 'metric' // metric or imperial
        },
        statistics: {
          totalItemsRecycled: 0,
          totalCO2Saved: 0,
          totalEnergySaved: 0,
          recyclingStreak: 0,
          lastRecyclingDate: null
        }
      };

      if (this.mockMode) {
        // Mock mode - store in memory
        this.mockUsers.set(user.email, user);
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }

      const { resource } = await this.container.items.create(user);
      
      // Remove password from returned user object
      const { password: _, ...userWithoutPassword } = resource;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Find user by email
  async findByEmail(email) {
    try {
      if (this.mockMode) {
        // Mock mode - search in memory
        return this.mockUsers.get(email.toLowerCase()) || null;
      }

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.email = @email',
        parameters: [
          { name: '@email', value: email.toLowerCase() }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      return resources.length > 0 ? resources[0] : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  // Find user by ID
  async findById(id) {
    try {
      if (this.mockMode) {
        // Mock mode - search by ID in all users
        for (const user of this.mockUsers.values()) {
          if (user.id === id) {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
          }
        }
        return null;
      }

      const { resource } = await this.container.item(id, id).read();
      if (resource) {
        const { password, ...userWithoutPassword } = resource;
        return userWithoutPassword;
      }
      return null;
    } catch (error) {
      if (error.code === 404) {
        return null;
      }
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Authenticate user
  async authenticate(email, password) {
    try {
      const user = await this.findByEmail(email);
      if (!user || !user.isActive) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email 
        },
        process.env.JWT_SECRET,
        { 
          expiresIn: process.env.JWT_EXPIRES_IN || '7d' 
        }
      );

      // Remove password from returned user object
      const { password: _, ...userWithoutPassword } = user;
      
      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      console.error('Error authenticating user:', error);
      throw error;
    }
  }

  // Update user profile
  async updateProfile(userId, updateData) {
    try {
      const user = await this.container.item(userId, userId).read();
      if (!user.resource) {
        throw new Error('User not found');
      }

      const updatedUser = {
        ...user.resource,
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      // Don't allow updating sensitive fields
      delete updatedUser.password;
      delete updatedUser.id;
      delete updatedUser.createdAt;

      const { resource } = await this.container.item(userId, userId).replace(updatedUser);
      
      const { password, ...userWithoutPassword } = resource;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Update user statistics
  async updateStatistics(userId, stats) {
    try {
      const user = await this.container.item(userId, userId).read();
      if (!user.resource) {
        throw new Error('User not found');
      }

      const updatedUser = {
        ...user.resource,
        statistics: {
          ...user.resource.statistics,
          ...stats
        },
        totalRecyclingEntries: (user.resource.totalRecyclingEntries || 0) + 1,
        updatedAt: new Date().toISOString()
      };

      const { resource } = await this.container.item(userId, userId).replace(updatedUser);
      
      const { password, ...userWithoutPassword } = resource;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error updating user statistics:', error);
      throw error;
    }
  }

  // Add badge to user
  async addBadge(userId, badge) {
    try {
      const user = await this.container.item(userId, userId).read();
      if (!user.resource) {
        throw new Error('User not found');
      }

      const badges = user.resource.badges || [];
      if (!badges.find(b => b.id === badge.id)) {
        badges.push({
          ...badge,
          earnedAt: new Date().toISOString()
        });

        const updatedUser = {
          ...user.resource,
          badges,
          updatedAt: new Date().toISOString()
        };

        const { resource } = await this.container.item(userId, userId).replace(updatedUser);
        const { password, ...userWithoutPassword } = resource;
        return userWithoutPassword;
      }
      
      return user.resource;
    } catch (error) {
      console.error('Error adding badge to user:', error);
      throw error;
    }
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await this.container.item(userId, userId).read();
      if (!user.resource) {
        throw new Error('User not found');
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.resource.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      const saltRounds = 10;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      const updatedUser = {
        ...user.resource,
        password: hashedNewPassword,
        updatedAt: new Date().toISOString()
      };

      await this.container.item(userId, userId).replace(updatedUser);
      return { message: 'Password updated successfully' };
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }
}

module.exports = new User();