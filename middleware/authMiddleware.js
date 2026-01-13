const jwt = require('jsonwebtoken');

// Protect routes - check if user is authenticated
const protect = (req, res, next) => {
  // Check session first
  if (req.session && req.session.userId) {
    return next();
  }

  // Check JWT token
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized, please login' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized, token invalid' 
    });
  }
};

// Check if user is logged in (for page redirects)
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/auth');
};

// Redirect to domain if already logged in
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect('/domain');
  }
  next();
};

module.exports = { protect, isAuthenticated, redirectIfAuthenticated };