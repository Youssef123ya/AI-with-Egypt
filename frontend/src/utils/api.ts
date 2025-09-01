import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import Cookies from 'js-cookie';
import { 
  ApiResponse, 
  AuthResponse, 
  LoginCredentials, 
  RegisterData,
  RecyclingFormData,
  RecyclingRecord,
  RecyclingHistoryResponse,
  RecyclingStatistics,
  RecyclingTrend,
  ClassificationResponse,
  RecyclingCentersResponse,
  GeocodeResult,
  RouteResult,
  User
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.clearAuthToken();
          // Redirect to login or emit event
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Token management
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return Cookies.get('auth_token') || localStorage.getItem('auth_token');
  }

  private setAuthToken(token: string): void {
    if (typeof window === 'undefined') return;
    Cookies.set('auth_token', token, { expires: 7, secure: true, sameSite: 'strict' });
    localStorage.setItem('auth_token', token);
  }

  private clearAuthToken(): void {
    if (typeof window === 'undefined') return;
    Cookies.remove('auth_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  }

  // Generic API method
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.api(config);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'An error occurred';
      throw new Error(errorMessage);
    }
  }

  // Authentication API
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>({
      method: 'POST',
      url: '/api/auth/login',
      data: credentials,
    });

    if (response.success && response.data.token) {
      this.setAuthToken(response.data.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_data', JSON.stringify(response.data.user));
      }
    }

    return response;
  }

  async register(userData: RegisterData): Promise<ApiResponse<{ user: User }>> {
    return this.request<ApiResponse<{ user: User }>>({
      method: 'POST',
      url: '/api/auth/register',
      data: userData,
    });
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return this.request<ApiResponse<{ user: User }>>({
      method: 'GET',
      url: '/api/auth/me',
    });
  }

  async updateProfile(updateData: Partial<User>): Promise<ApiResponse<{ user: User }>> {
    const response = await this.request<ApiResponse<{ user: User }>>({
      method: 'PUT',
      url: '/api/auth/profile',
      data: updateData,
    });

    if (response.success && response.data?.user) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_data', JSON.stringify(response.data.user));
      }
    }

    return response;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.request<ApiResponse<void>>({
      method: 'PUT',
      url: '/api/auth/change-password',
      data: { currentPassword, newPassword },
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request<ApiResponse<void>>({
        method: 'POST',
        url: '/api/auth/logout',
      });
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    }
    
    this.clearAuthToken();
  }

  async validateToken(): Promise<ApiResponse<{ userId: string; email: string }>> {
    return this.request<ApiResponse<{ userId: string; email: string }>>({
      method: 'GET',
      url: '/api/auth/validate',
    });
  }

  // Recycling API
  async classifyImage(imageFile: File, returnConfidence = true): Promise<ClassificationResponse> {
    const formData = new FormData();
    formData.append('image', imageFile);

    return this.request<ClassificationResponse>({
      method: 'POST',
      url: `/api/recycling/classify?returnConfidence=${returnConfidence}`,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async logRecycling(recordData: RecyclingFormData): Promise<ApiResponse<{ record: RecyclingRecord }>> {
    return this.request<ApiResponse<{ record: RecyclingRecord }>>({
      method: 'POST',
      url: '/api/recycling/log',
      data: recordData,
    });
  }

  async getRecyclingHistory(limit = 50, offset = 0): Promise<ApiResponse<RecyclingHistoryResponse>> {
    return this.request<ApiResponse<RecyclingHistoryResponse>>({
      method: 'GET',
      url: `/api/recycling/history?limit=${limit}&offset=${offset}`,
    });
  }

  async getRecyclingStatistics(period: 'week' | 'month' | 'year' | 'all' = 'all'): Promise<ApiResponse<{ statistics: RecyclingStatistics }>> {
    return this.request<ApiResponse<{ statistics: RecyclingStatistics }>>({
      method: 'GET',
      url: `/api/recycling/statistics?period=${period}`,
    });
  }

  async getGlobalStatistics(period: 'week' | 'month' | 'year' | 'all' = 'all'): Promise<ApiResponse<{ statistics: RecyclingStatistics }>> {
    return this.request<ApiResponse<{ statistics: RecyclingStatistics }>>({
      method: 'GET',
      url: `/api/recycling/global-stats?period=${period}`,
    });
  }

  async getRecyclingTrends(period: 'week' | 'month' | 'year' = 'month', groupBy: 'day' | 'week' | 'month' = 'day'): Promise<ApiResponse<{ trends: RecyclingTrend[] }>> {
    return this.request<ApiResponse<{ trends: RecyclingTrend[] }>>({
      method: 'GET',
      url: `/api/recycling/trends?period=${period}&groupBy=${groupBy}`,
    });
  }

  async updateRecyclingRecord(recordId: string, updateData: Partial<RecyclingRecord>): Promise<ApiResponse<{ record: RecyclingRecord }>> {
    return this.request<ApiResponse<{ record: RecyclingRecord }>>({
      method: 'PUT',
      url: `/api/recycling/${recordId}`,
      data: updateData,
    });
  }

  async deleteRecyclingRecord(recordId: string): Promise<ApiResponse<void>> {
    return this.request<ApiResponse<void>>({
      method: 'DELETE',
      url: `/api/recycling/${recordId}`,
    });
  }

  // Maps API
  async findRecyclingCenters(
    latitude: number, 
    longitude: number, 
    radius = 10, 
    category = 'all', 
    limit = 20
  ): Promise<RecyclingCentersResponse> {
    return this.request<RecyclingCentersResponse>({
      method: 'GET',
      url: `/api/maps/recycling-centers?latitude=${latitude}&longitude=${longitude}&radius=${radius}&category=${category}&limit=${limit}`,
    });
  }

  async geocodeAddress(address: string, countrySet = 'US'): Promise<ApiResponse<{ query: string; results: GeocodeResult[] }>> {
    return this.request<ApiResponse<{ query: string; results: GeocodeResult[] }>>({
      method: 'GET',
      url: `/api/maps/geocode?address=${encodeURIComponent(address)}&countrySet=${countrySet}`,
    });
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<ApiResponse<{ coordinates: { latitude: number; longitude: number }; address: any }>> {
    return this.request<ApiResponse<{ coordinates: { latitude: number; longitude: number }; address: any }>>({
      method: 'GET',
      url: `/api/maps/reverse-geocode?latitude=${latitude}&longitude=${longitude}`,
    });
  }

  async getRoute(
    startLatitude: number, 
    startLongitude: number, 
    endLatitude: number, 
    endLongitude: number,
    travelMode = 'car'
  ): Promise<ApiResponse<{ route: RouteResult; start: { latitude: number; longitude: number }; end: { latitude: number; longitude: number } }>> {
    return this.request<ApiResponse<{ route: RouteResult; start: { latitude: number; longitude: number }; end: { latitude: number; longitude: number } }>>({
      method: 'GET',
      url: `/api/maps/route?startLatitude=${startLatitude}&startLongitude=${startLongitude}&endLatitude=${endLatitude}&endLongitude=${endLongitude}&travelMode=${travelMode}`,
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
    return this.request<{ status: string; timestamp: string; version: string }>({
      method: 'GET',
      url: '/health',
    });
  }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;

// Helper functions for common operations
export const authAPI = {
  login: (credentials: LoginCredentials) => apiService.login(credentials),
  register: (userData: RegisterData) => apiService.register(userData),
  getCurrentUser: () => apiService.getCurrentUser(),
  updateProfile: (data: Partial<User>) => apiService.updateProfile(data),
  changePassword: (current: string, newPassword: string) => apiService.changePassword(current, newPassword),
  logout: () => apiService.logout(),
  validateToken: () => apiService.validateToken(),
};

export const recyclingAPI = {
  classify: (file: File, returnConfidence?: boolean) => apiService.classifyImage(file, returnConfidence),
  log: (data: RecyclingFormData) => apiService.logRecycling(data),
  getHistory: (limit?: number, offset?: number) => apiService.getRecyclingHistory(limit, offset),
  getStatistics: (period?: 'week' | 'month' | 'year' | 'all') => apiService.getRecyclingStatistics(period),
  getGlobalStats: (period?: 'week' | 'month' | 'year' | 'all') => apiService.getGlobalStatistics(period),
  getTrends: (period?: 'week' | 'month' | 'year', groupBy?: 'day' | 'week' | 'month') => apiService.getRecyclingTrends(period, groupBy),
  update: (id: string, data: Partial<RecyclingRecord>) => apiService.updateRecyclingRecord(id, data),
  delete: (id: string) => apiService.deleteRecyclingRecord(id),
};

export const mapsAPI = {
  findCenters: (lat: number, lng: number, radius?: number, category?: string, limit?: number) => 
    apiService.findRecyclingCenters(lat, lng, radius, category, limit),
  geocode: (address: string, countrySet?: string) => apiService.geocodeAddress(address, countrySet),
  reverseGeocode: (lat: number, lng: number) => apiService.reverseGeocode(lat, lng),
  getRoute: (startLat: number, startLng: number, endLat: number, endLng: number, mode?: string) => 
    apiService.getRoute(startLat, startLng, endLat, endLng, mode),
};

export { apiService };