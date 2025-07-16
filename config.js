// Configuration for API endpoints
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:4000'
  : 'https://fitpickd.vercel.app';

// Export for use in other files
window.API_BASE = API_BASE; 