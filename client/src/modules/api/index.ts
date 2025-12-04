// ========================================
// 🌐 API Client Module
// ========================================
// Handles REST API calls to Gate & Relay servers

export class APIClient {
  private baseUrl: string = '';
  private token: string = '';

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl;
    this.token = token || '';
  }

  async get(path: string) {
    // GET request
  }

  async post(path: string, data: any) {
    // POST request
  }

  async put(path: string, data: any) {
    // PUT request
  }

  async delete(path: string) {
    // DELETE request
  }

  async sendMessage(text: string, role: string) {
    // Send message to Gate server
  }

  async fetchTracks() {
    // Fetch track list
  }
}

export default APIClient;
