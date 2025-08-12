/**
 * API Client for Frontend to BFF Communication
 * Handles all API calls through the BFF service
 */

const BFF_BASE_URL = process.env.NEXT_PUBLIC_BFF_URL || 'http://localhost:9000';
const BFF_API_URL = process.env.NEXT_PUBLIC_BFF_API_URL || 'http://localhost:9000/api';

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;
  private apiUrl: string;

  constructor() {
    this.baseUrl = BFF_BASE_URL;
    this.apiUrl = BFF_API_URL;
    console.log('🔗 API Client initialized:', {
      baseUrl: this.baseUrl,
      apiUrl: this.apiUrl,
    });
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    console.log(`🔗 API Request: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      
      try {
        const errorData = await response.json();
        // Extract meaningful error message from backend response
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If we can't parse the error response, use the default message
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Health Checks
  async checkBffHealth() {
    return this.request(`${this.baseUrl}/health`);
  }

  async checkFullHealth() {
    return this.request(`${this.baseUrl}/health/full`);
  }

  async checkGamingServicesHealth() {
    return this.request('/health');
  }

  // Fixtures API
  async getFixtures() {
    return this.request('/fixtures');
  }

  async getLiveFixtures() {
    return this.request('/fixtures/live');
  }

  async getFixtureById(id: string) {
    return this.request(`/fixtures/${id}`);
  }

  async syncFixtures(data?: { date: string }) {
    return this.request('/fixtures/sync', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  // Serie A specific endpoint
  async getUpcomingSerieAFixtures(days: number = 7) {
    return this.request(`/fixtures/upcoming/serie-a?days=${days}`);
  }

  // Teams API
  async getTeams() {
    return this.request('/teams');
  }

  async getTeamById(id: string) {
    return this.request(`/teams/${id}`);
  }

  async getTeamStatistics(id: string) {
    return this.request(`/teams/${id}/statistics`);
  }

  async getTeamVsTeam(id1: string, id2: string) {
    return this.request(`/teams/${id1}/vs/${id2}`);
  }

  // User Management API
  async registerUser(userData: {
    email: string;
    name: string;
    nickname: string;
    password: string;
  }) {
    return this.request('/users/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async syncGoogleUser(firebaseIdToken: string) {
    return this.request('/users/sync-google', {
      method: 'POST',
      body: JSON.stringify({ firebaseIdToken }),
    });
  }

  async completeProfile(userId: string, profileData: { nickname: string }) {
    return this.request(`/users/complete-profile/${userId}`, {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  }

  async getUserProfile(userId: string) {
    return this.request(`/users/profile/${userId}`);
  }

  async getUserByFirebaseUid(firebaseUid: string) {
    return this.request(`/users/profile/firebase/${firebaseUid}`);
  }

  // Prediction Management API
  async getUserSummary(userId: string, mode: 'live' | 'test' = 'live') {
    return this.request(`/predictions/user/${userId}/summary?mode=${mode}`);
  }

  async getUserWeeklyPredictions(userId: string, mode: 'live' | 'test' = 'live') {
    return this.request(`/predictions/weekly/${userId}?mode=${mode}`);
  }

  async createPrediction(data: {
    userId: string;
    fixtureId: number;
    prediction: string;
    mode?: 'live' | 'test';
  }) {
    return this.request('/predictions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Test Mode API
  async resetTestData(userId: string) {
    return this.request(`/test-mode/reset/${userId}`, {
      method: 'DELETE',
    });
  }

  async seedTestFixtures() {
    return this.request('/test-mode/seed', {
      method: 'POST',
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
