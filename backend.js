// Backend server for FitPickd: handles API endpoints, authentication, and database operations

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

// Configure Cloudinary for image storage
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Initialize Express app
const app = express();
app.set('trust proxy', 1); // Trust first proxy (needed for correct IP detection behind Render/Vercel/etc)
const upload = multer({ dest: 'uploads/' });

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://accounts.google.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://fitpickd.vercel.app'] // Add your actual Vercel URL
    : 'https://fitpickd.vercel.app',
  credentials: true
}));

// Session configuration for secure cookies
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 1 day in seconds
    autoRemove: 'native' // Let MongoDB handle expired session removal
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'
  }
}));

// Rate limiting for admin routes
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // allow up to 100 requests per 15 minutes
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 1000 for dev, 100 for prod
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalRateLimit);
app.use(cookieParser());

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Configure Google OAuth for email verification
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_OAUTH_REDIRECT_URI,
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails && profile.emails[0] && profile.emails[0].value;
  return done(null, { email });
}));

// Admin schema for authorized admin emails only
const adminEmailSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  isActive: { type: Boolean, default: true },
  addedBy: { type: String, default: 'system' },
}, { timestamps: true });

// Admin model for emails only
const AdminEmail = mongoose.model('AdminEmail', adminEmailSchema);

// Admin login log schema and model
const adminLoginLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  loginAt: { type: Date, default: Date.now }
});
const AdminLoginLog = mongoose.model('AdminLoginLog', adminLoginLogSchema);

app.use(passport.initialize());

// Google OAuth Routes
app.get('/auth/google', passport.authenticate('google', {
  scope: ['email'],
  session: false,
}));

app.get('/auth/google/callback', passport.authenticate('google', { 
  session: false, 
  failureRedirect: 'https://fitpickd.vercel.app/signup.html?error=oauth_failed' 
}), (req, res) => {
  const email = req.user.email;
  const state = req.query.state;
  
  if (state === 'not-an-admin') {
    res.redirect(`/not-an-admin-login?verified_email=${encodeURIComponent(email)}`);
  } else if (state === 'forgot-password') {
    const baseUrl = process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : 'https://fitpickd.vercel.app';
    res.redirect(`${baseUrl}/forgot-password.html?email=${encodeURIComponent(email)}`);
  } else {
    const baseUrl = process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : 'https://fitpickd.vercel.app';
    res.redirect(`${baseUrl}/signup.html?verified_email=${encodeURIComponent(email)}`);
  }
});

app.get('/auth/google/forgot-password', passport.authenticate('google', {
  scope: ['email'],
  session: false,
  state: 'forgot-password'
}));

// Admin OAuth route
app.get('/auth/google/not-an-admin', passport.authenticate('google', {
  scope: ['email'],
  session: false,
  state: 'not-an-admin'
}));

// Database Schemas
const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  price: Number,
  description: String,
  images: [{ url: String, public_id: String }],
  sizes: [String],
  featured: { type: Boolean, default: false },
  outOfStock: { type: Boolean, default: false },
  fabricComposition: { type: String, default: '' },
  fit: { type: String, default: '' },
  countryOfOrigin: { type: String, default: '' },
  careInstruction: { type: String, default: '' },
});

const customerSchema = new mongoose.Schema({
  firstName: String,
  email: String,
  phone: String,
  password: String,
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
}, { timestamps: true }); // This adds createdAt and updatedAt fields automatically

const Product = mongoose.model('Product', productSchema);
const Customer = mongoose.model('Customer', customerSchema);

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.admin_token;
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-change-in-production');
    
    // Verify the email from token is still valid
    const adminEmail = await AdminEmail.findOne({ 
      email: decoded.email, 
      isActive: true 
    });
    
    if (!adminEmail) {
      return res.status(401).json({ error: 'Invalid token or admin email no longer authorized.' });
    }

    req.admin = { email: decoded.email };
    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    res.status(401).json({ error: 'Invalid token.' });
  }
};

// Admin email verification endpoint
app.post('/admin/verify-email', adminRateLimit, express.json(), async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const adminEmail = await AdminEmail.findOne({ email: email.toLowerCase(), isActive: true });
    
    if (adminEmail) {
      res.json({ valid: true, message: 'Email authorized for admin access' });
    } else {
      res.json({ valid: false, message: 'Email not authorized for admin access' });
    }
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Admin login endpoint
app.post('/admin/login', adminRateLimit, express.json(), async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Username, password, and email are required' });
    }

    // Verify credentials from environment variables
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminUsername || !adminPassword) {
      console.error('Admin credentials not configured in environment variables');
      return res.status(500).json({ error: 'Admin configuration error' });
    }

    // Check if username matches
    if (username !== adminUsername) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, adminPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify email is authorized
    const adminEmail = await AdminEmail.findOne({ email: email.toLowerCase(), isActive: true });
    if (!adminEmail) {
      return res.status(401).json({ error: 'Email not authorized for admin access' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { email: email.toLowerCase() },
      process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
      { expiresIn: '24h' }
    );

    // Set secure cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true in production, false in dev
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Log admin login
    await AdminLoginLog.create({ email: email.toLowerCase() });
    const count = await AdminLoginLog.countDocuments();
    if (count > 50) {
      const oldest = await AdminLoginLog.find().sort({ loginAt: 1 }).limit(count - 50);
      const idsToDelete = oldest.map(doc => doc._id);
      await AdminLoginLog.deleteMany({ _id: { $in: idsToDelete } });
    }

    res.json({ 
      success: true, 
      token,
      admin: { 
        username: adminUsername, 
        email: email.toLowerCase() 
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Admin logout endpoint
app.post('/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Serve admin dashboard only if authenticated
app.get('/admin/dashboard', authenticateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'not-an-admin.html'));
});
// Serve admin login page (public)
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'not-an-admin-login.html'));
});

// Admin token verification endpoint
app.get('/admin/verify-token', authenticateAdmin, (req, res) => {
  res.json({ 
    success: true, 
    admin: { 
      username: process.env.ADMIN_USERNAME, 
      email: req.admin.email 
    }
  });
});

// Image Upload Endpoint (protected with admin authentication)
app.post('/upload', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'fitpickd',
    });
    fs.unlinkSync(filePath);
    res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// Product Management Endpoints (protected with admin authentication)
app.post('/products', authenticateAdmin, express.json(), async (req, res) => {
  try {
    let { name, category, price, description, sizes, images, fabricComposition, fit, countryOfOrigin, careInstruction } = req.body;
    price = Number(price);
    if (!Array.isArray(sizes)) {
      sizes = sizes ? sizes.split(',').map(s => s.trim()) : [];
    }
    
    const product = new Product({
      name, category, price, description, images, sizes,
      fabricComposition: fabricComposition || '',
      fit: fit || '',
      countryOfOrigin: countryOfOrigin || '',
      careInstruction: careInstruction || '',
    });
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Product creation failed', details: err.message });
  }
});

app.get('/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.get('/products/available', async (req, res) => {
  const products = await Product.find({ outOfStock: { $ne: true } });
  res.json(products);
});

app.delete('/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    await Promise.all(product.images.map(img => cloudinary.uploader.destroy(img.public_id)));
    await product.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', details: err.message });
  }
});

app.patch('/products/:id', authenticateAdmin, express.json(), async (req, res) => {
  try {
    const { name, category, price, description, sizes, fabricComposition, fit, countryOfOrigin, careInstruction } = req.body;
    const update = {
      name, category, price: Number(price), description,
      sizes: Array.isArray(sizes) ? sizes : (sizes ? sizes.split(',').map(s => s.trim()) : []),
      fabricComposition: fabricComposition || '',
      fit: fit || '',
      countryOfOrigin: countryOfOrigin || '',
      careInstruction: careInstruction || '',
    };
    
    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product', details: err.message });
  }
});

app.patch('/products/:id/featured', authenticateAdmin, express.json(), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    product.featured = !product.featured;
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle featured status', details: err.message });
  }
});

app.patch('/products/:id/out-of-stock', authenticateAdmin, express.json(), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    product.outOfStock = !product.outOfStock;
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle out of stock status', details: err.message });
  }
});

app.get('/products/out-of-stock', async (req, res) => {
  try {
    const products = await Product.find({ outOfStock: true });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch out of stock products', details: err.message });
  }
});

app.patch('/products/:id/images', authenticateAdmin, express.json(), async (req, res) => {
  try {
    let { images } = req.body;
    if (Array.isArray(images) && images.length > 6) {
      images = images.slice(0, 6);
    }
    
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    const oldPublicIds = (product.images || []).map(img => img.public_id);
    const newPublicIds = (images || []).map(img => img.public_id);
    const removedPublicIds = oldPublicIds.filter(id => id && !newPublicIds.includes(id));
    
    await Promise.all(removedPublicIds.map(public_id => cloudinary.uploader.destroy(public_id)));
    product.images = images;
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update images', details: err.message });
  }
});

// Customer Management Endpoints
app.post('/customers', express.json(), async (req, res) => {
  try {
    const { firstName, email, phone, password } = req.body;
    const customer = new Customer({ firstName, email, phone, password });
    await customer.save();
    res.json({ success: true, user: { id: customer._id, firstName: customer.firstName, email: customer.email, phone: customer.phone, createdAt: customer.createdAt } });
  } catch (err) {
    res.status(500).json({ error: 'Customer creation failed', details: err.message });
  }
});

app.get('/customers', async (req, res) => {
  const customers = await Customer.find();
  res.json(customers);
});

app.delete('/customers/:id', async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', details: err.message });
  }
});

app.post('/customers/login', express.json(), async (req, res) => {
  const { email, password } = req.body;
  const user = await Customer.findOne({
    $or: [{ email }, { phone: email }],
    password
  });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email, phone, or password' });
  }
  res.json({ success: true, user: { id: user._id, firstName: user.firstName, email: user.email, phone: user.phone } });
});

app.patch('/customers/:id', express.json(), async (req, res) => {
  try {
    const { firstName, email, phone } = req.body;
    const customerId = req.params.id;
    
    const existingEmail = await Customer.findOne({ email, _id: { $ne: customerId } });
    if (existingEmail) {
      return res.status(400).json({ error: 'This email address is already registered with another account.' });
    }
    
    const existingPhone = await Customer.findOne({ phone, _id: { $ne: customerId } });
    if (existingPhone) {
      return res.status(400).json({ error: 'This phone number is already registered with another account.' });
    }
    
    const updated = await Customer.findByIdAndUpdate(
      customerId,
      { firstName, email, phone },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ success: true, user: { id: updated._id, firstName: updated.firstName, email: updated.email, phone: updated.phone } });
  } catch (err) {
    console.error('Failed to update profile for customer:', req.params.id, err);
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});

app.post('/customers/:id/verify-password', express.json(), async (req, res) => {
  try {
    const { password } = req.body;
    const customerId = req.params.id;
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    if (customer.password !== password) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify password', details: err.message });
  }
});

app.patch('/customers/:id/password', express.json(), async (req, res) => {
  try {
    const { password } = req.body;
    const customerId = req.params.id;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    const updated = await Customer.findByIdAndUpdate(
      customerId,
      { password },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password', details: err.message });
  }
});

// Wishlist Management Endpoints
app.post('/customers/:id/wishlist', express.json(), async (req, res) => {
  try {
    const customerId = req.params.id;
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId required' });
    
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (!customer.wishlist) customer.wishlist = [];
    if (!customer.wishlist.includes(productId)) {
      customer.wishlist.push(productId);
      await customer.save();
    }
    res.json({ success: true, wishlist: customer.wishlist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to wishlist', details: err.message });
  }
});

app.delete('/customers/:id/wishlist', express.json(), async (req, res) => {
  try {
    const customerId = req.params.id;
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId required' });
    
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    customer.wishlist = (customer.wishlist || []).filter(id => id.toString() !== productId);
    await customer.save();
    res.json({ success: true, wishlist: customer.wishlist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from wishlist', details: err.message });
  }
});

app.get('/customers/:id/wishlist', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).populate('wishlist');
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ wishlist: customer.wishlist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wishlist', details: err.message });
  }
});

// Password Recovery Endpoint
app.post('/auth/forgot-password', express.json(), async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const customer = await Customer.findOne({ email: email.toLowerCase() });
    
    if (!customer) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }
    
    res.json({ 
      success: true, 
      password: customer.password,
      message: 'Password found successfully'
    });
    
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process forgot password request', details: err.message });
  }
});

// Image Management Endpoint (protected with admin authentication)
app.delete('/images', authenticateAdmin, express.json(), async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.status(400).json({ error: 'public_id required' });
    const result = await cloudinary.uploader.destroy(public_id);
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', details: err.message });
  }
});

// Static File Serving
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/html', express.static(path.join(__dirname, 'html')));
// Serve admin login and dashboard assets from backend root
app.use(express.static(__dirname));

// Root route
app.get('/', (req, res) => {
  res.send('FitPickd Backend is running!');
});

// Updated admin dashboard route
app.get('/not-an-admin', authenticateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'not-an-admin.html'));
});

// Updated admin login route to serve from root
app.get('/not-an-admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'not-an-admin-login.html'));
});

// Start server
const PORT = 4000;
app.listen(PORT, () => {
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://fitpickd-backend.onrender.com'
    : `http://localhost:${PORT}`;
  console.log(`FitPickd server running on ${baseUrl}`);
}); 