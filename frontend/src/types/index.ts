// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  totalRecyclingEntries: number;
  totalPointsEarned: number;
  badges: Badge[];
  preferences: UserPreferences;
  statistics: UserStatistics;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'recycling' | 'streak' | 'impact' | 'community';
  earnedAt: string;
}

export interface UserPreferences {
  notifications: boolean;
  emailUpdates: boolean;
  units: 'metric' | 'imperial';
}

export interface UserStatistics {
  totalItemsRecycled: number;
  totalCO2Saved: number;
  totalEnergySaved: number;
  recyclingStreak: number;
  lastRecyclingDate: string | null;
}

// Authentication Types
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
}

// Recycling Types
export type WasteCategory = 'recyclable' | 'organic' | 'hazardous' | 'non_recyclable';

export type WasteSubcategory = 
  | 'plastic_bottles' | 'glass' | 'paper' | 'cans' | 'cardboard'
  | 'food_scraps' | 'yard_trimmings' | 'coffee_tea_bags' | 'egg_shells' | 'kitchen_waste'
  | 'batteries' | 'e_waste' | 'paints' | 'pesticides'
  | 'ceramic' | 'diapers' | 'plastic_bags' | 'sanitary' | 'styrofoam';

export interface RecyclingRecord {
  id: string;
  userId: string;
  itemType: string;
  category: WasteCategory;
  subcategory: WasteSubcategory;
  quantity: number;
  weight?: number;
  imageUrl?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  notes?: string;
  classificationConfidence?: number;
  environmentalImpact: EnvironmentalImpact;
  createdAt: string;
  updatedAt: string;
  isVerified: boolean;
  recyclingMethod?: string;
  recyclingCenter?: string;
}

export interface EnvironmentalImpact {
  co2Saved: number;
  energySaved: number;
  pointsEarned: number;
}

export interface RecyclingHistoryResponse {
  records: RecyclingRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface RecyclingStatistics {
  totalItems: number;
  totalQuantity: number;
  totalCO2Saved: number;
  totalEnergySaved: number;
  totalPoints: number;
  categoryBreakdown: CategoryBreakdown[];
  period: 'week' | 'month' | 'year' | 'all';
}

export interface CategoryBreakdown {
  category: WasteCategory;
  count: number;
  quantity: number;
  co2Saved: number;
  energySaved: number;
  points: number;
}

export interface RecyclingTrend {
  period: string;
  count: number;
  quantity: number;
  co2Saved: number;
  energySaved: number;
}

// Classification Types
export interface ClassificationResult {
  itemType: string;
  category: WasteCategory;
  subcategory: WasteSubcategory;
  confidence: number;
}

export interface ClassificationResponse {
  success: boolean;
  message: string;
  data: {
    imageUrl?: string;
    classification: ClassificationResult;
    allPredictions?: ClassificationPrediction[];
    alternativePredictions?: ClassificationPrediction[];
  };
}

export interface ClassificationPrediction {
  tagName: string;
  probability: number;
}

// Map Types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RecyclingCenter {
  id: string;
  name: string;
  address: string;
  phone?: string;
  coordinates: Coordinates;
  acceptedMaterials: string[];
  hours: string;
  website?: string;
  rating?: number;
  distance: number;
}

export interface RecyclingCentersResponse {
  success: boolean;
  data: {
    centers: RecyclingCenter[];
    searchParams: {
      location: Coordinates;
      radius: number;
      category: string;
      limit: number;
    };
    metadata: {
      total: number;
      maxRadius: number;
      searchTimestamp: string;
    };
  };
}

export interface GeocodeResult {
  address: string;
  coordinates: Coordinates;
  confidence: number;
  type: string;
  viewport?: {
    topLeft: Coordinates;
    bottomRight: Coordinates;
  };
}

export interface RouteResult {
  distance: number; // in km
  duration: number; // in minutes
  trafficDelay: number; // in seconds
  geometry: Coordinates[];
}

// Form Types
export interface RecyclingFormData {
  itemType: string;
  category: WasteCategory;
  subcategory: WasteSubcategory;
  quantity: number;
  weight?: number;
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  imageFile?: File;
  imageUrl?: string;
  classificationConfidence?: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: string[];
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: string[];
}

// App State Types
export interface AppState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Filter and Search Types
export interface RecyclingFilter {
  category?: WasteCategory;
  subcategory?: WasteSubcategory;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: 'date' | 'impact' | 'quantity';
  sortOrder?: 'asc' | 'desc';
}

export interface MapFilter {
  category: string;
  radius: number;
  showRoute: boolean;
}

// Chart Data Types
export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export interface TrendData {
  date: string;
  recycled: number;
  co2Saved: number;
  energySaved: number;
}

// Notification Types
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  autoClose?: boolean | number;
}

// Theme Types
export type ColorScheme = 'light' | 'dark';

export interface ThemeSettings {
  colorScheme: ColorScheme;
  primaryColor: string;
}

// File Upload Types
export interface FileUpload {
  file: File;
  preview?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}