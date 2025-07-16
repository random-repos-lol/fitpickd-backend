// Configuration for API endpoints
const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:4000' 
  : 'https://your-backend.onrender.com'; // Replace with your actual Render URL

// Export for use in other files
window.API_BASE = API_BASE; 