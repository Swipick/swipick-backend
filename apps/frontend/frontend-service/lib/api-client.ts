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

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('/api') 
      ? `${this.baseUrl}${endpoint}`
      : endpoint.startsWith('http') 
        ? endpoint
        : `${this.apiUrl}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log('🌐 API Request:', { method: config.method || 'GET', url });
      
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      console.log('📡 API Response:', { 
        status: response.status, 
        statusText: response.statusText,
        url 
      });

      return {
        data,
        status: response.status,
        error: !response.ok ? data?.message || response.statusText : undefined,
      };
    } catch (error) {
      console.error('❌ API Error:', error);
      return {
        status: 500,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
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
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
