# FitPickd Backend

FitPickd is a premium men's clothing e-commerce platform. This repository contains the **backend server** for FitPickd, built with Node.js, Express, and MongoDB. It provides RESTful APIs, authentication (including Google OAuth), admin dashboard, and static file serving for the frontend.

---

## Features
- User authentication (email/password, Google OAuth)
- Admin dashboard for managing products, inventory, and customer accounts
- Product and customer management APIs
- Wishlist and password recovery endpoints
- Image upload and management (Cloudinary integration)
- Secure session and JWT-based authentication
- Rate limiting, security headers, and CORS
- Serves static frontend and admin dashboard assets

---

## Folder Structure
```
fitpickd-backend/
  backend.js            # Main backend server
  not-an-admin.html     # Admin dashboard (HTML)
  admin-styles.css      # Admin dashboard styles
  admin-script.js       # Admin dashboard logic
  config.js             # Admin dashboard config
  admin-fitpickd-logo.png # Admin dashboard logo
  package.json          # Node.js dependencies and scripts
  package-lock.json     # Dependency lock file
  .env                  # Environment variables (not committed)
  ...                   # Other static assets and folders
```

---

## Getting Started

### 1. **Clone the Repository**
```sh
git clone https://github.com/yourusername/fitpickd-backend.git
cd fitpickd-backend
```

### 2. **Install Dependencies**
```sh
npm install
```

### 3. **Set Up Environment Variables**
- Create a `.env` file in the root of `fitpickd-backend` (see `.env.example` for required variables).
- **Do not commit your real `.env` to GitHub.**

### 4. **Run the Server Locally**
```sh
npm start
```
- The backend will run on [http://localhost:4000](http://localhost:4000) by default.

### 5. **Build Tailwind CSS (if needed)**
```sh
npm run build:css
```

---

## Deployment
- Deploy to platforms like **Render** or **Heroku**.
- Set all required environment variables in your deployment dashboard.
- The backend will serve both API endpoints and static assets (including the admin dashboard).

---

## Admin Dashboard
- Access the admin dashboard at `/admin/dashboard` (e.g., `https://your-backend.onrender.com/admin/dashboard`).
- Admin login is protected and requires credentials set in your environment variables.
- Manage products, inventory, and customer accounts from the dashboard.

---

## Environment Variables
See `.env.example` for a full list of required environment variables, including:
- MongoDB connection string
- Session and JWT secrets
- Admin credentials (username and bcrypt-hashed password)
- Google OAuth credentials and redirect URI
- Frontend URL (for CORS)
- Cloudinary credentials (for image uploads)

---

## API Endpoints
- RESTful endpoints for products, customers, wishlist, authentication, and admin actions.
- See `backend.js` for full API documentation and routes.

---

## Notes
- **Do not commit your `.env` or any secrets to GitHub.**
- The `ADMIN_SETUP.md` file is not included in the repository and should be kept private.
- For any admin setup or advanced configuration, refer to your local documentation.

---

## License
MIT 