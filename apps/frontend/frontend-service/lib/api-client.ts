/**
 * API Client for Frontend to BFF Communication
 * Handles all API calls through the BFF service
 */

const BFF_BASE_URL = process.env.NEXT_PUBLIC_BFF_URL || 'http://localhost:9000';
const BFF_API_URL = process.env.NEXT_PUBLIC_BFF_API_URL || 'http://localhost:9000/api';

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

  async updateEmailVerified(userId: string, emailVerified: boolean) {
    return this.request(`/users/${userId}/email-verified`, {
      method: 'PATCH',
      body: JSON.stringify({ emailVerified }),
    });
  }

  // Prediction Management API
  async getUserSummary(userId: string, mode: 'live' | 'test' = 'live') {
    return this.request(`/predictions/user/${userId}/summary?mode=${mode}`);
  }

  // User KPIs (server-side aggregation)
  async getUserProfileKpis(userId: string) {
    return this.request(`/users/${userId}/profile-kpis`);
  }

  // Notification preferences
  async getUserPreferences(userId: string) {
    return this.request(`/users/${userId}/preferences`);
  }

  async updateUserPreferences(
    userId: string,
    patch: { results?: boolean; matches?: boolean; goals?: boolean },
  ) {
    return this.request(`/users/${userId}/preferences`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  // Update avatar URL (after uploading to storage)
  async updateUserAvatar(userId: string, url: string) {
    return this.request(`/users/${userId}/avatar`, {
      method: 'PATCH',
      body: JSON.stringify({ url }),
    });
  }

  // Upload avatar bytes (multipart) to Neon-backed endpoint
  async uploadUserAvatarBytes(userId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const url = `${this.apiUrl}/users/${userId}/avatar/upload`;
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
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

  // Test Mode predictions via BFF unified route
  async createTestModePrediction(data: {
    userId: string; // UUID supported by BFF
    fixtureId: number;
    choice: '1' | 'X' | '2';
  }) {
    return this.request('/predictions', {
      method: 'POST',
      body: JSON.stringify({ ...data, mode: 'test' as const }),
    });
  }

  // Test Mode API
  async getTestFixtures(week: number = 1) {
    // Default to week 1 if no week specified
    return this.request(`/test-mode/fixtures/week/${week}`);
  }

  async getTestFixturesByWeek(week: number) {
    return this.request(`/test-mode/fixtures/week/${week}`);
  }

  async getTestWeeks() {
    return this.request('/test-mode/weeks');
  }

  async createTestPrediction(data: {
    userId: string; // UUID
    fixtureId: number;
    choice: '1' | 'X' | '2';
  }) {
    return this.request('/test-mode/predictions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTestWeeklyStats(userId: string | number, week: number) {
    // Use BFF mode-switching endpoint to reach gaming test-mode stats
    return this.request(`/predictions/user/${userId}/week/${week}?mode=test`);
  }

  async getTestUserSummary(userId: string | number) {
    // Use BFF mode-switching endpoint to reach gaming test-mode summary
    return this.request(`/predictions/user/${userId}/summary?mode=test`);
  }

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

  async getTestMatchCardsByWeek(week: number, userId?: string) {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request(`/test-mode/match-cards/week/${week}${qs}`);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
