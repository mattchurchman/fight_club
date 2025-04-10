// Import required modules
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Pool } = require('pg'); // PostgreSQL client

console.log('Starting UFC Card Entry application');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${process.env.PORT}`);
console.log(`Database URL exists: ${!!process.env.DATABASE_URL}`);
console.log(`Session Secret exists: ${!!process.env.SESSION_SECRET}`);

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: false 
  } 

});


// Connect to database and handle connection errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1);

// Session configuration with PostgreSQL
const expressSession = require('express-session');
const pgSession = require('connect-pg-simple')(expressSession);

app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || '9ded3e07971e3d3d44dca8bdab24f813b7a65525815f8a78898e823fbd059218840dd64e006f49949eecfbbf9627d0705739bcb408f00332b162ac417df3fcee',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', 
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

// Add at the top of your file
function checkRequiredEnvVars() {
  const required = ['DATABASE_URL', 'SESSION_SECRET'];
  const missing = required.filter(name => !process.env[name]);
  
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// Call this early in your app startup
if (process.env.NODE_ENV === 'production') {
  checkRequiredEnvVars();
}

// Start the server
app.listen(port, () => {
  console.log(`UFC Card Entry server running on http://localhost:${port}`);
});

// Initialize database tables
async function initDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create session table for storing sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    
    // Create fight_cards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fight_cards (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        fights JSONB NOT NULL,
        results JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create user_bets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_bets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        username VARCHAR(50) NOT NULL,
        event_name VARCHAR(50) NOT NULL,
        json_data JSONB NOT NULL,
        results_data JSONB,
        tokens INTEGER
      )
    `);

    // Create fight_schedule table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fight_schedule (
        id SERIAL PRIMARY KEY,
        event TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create password_reset_tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    await client.query('COMMIT');
    console.log('Database tables initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database tables', err);
    throw err;
  } finally {
    client.release();
  }
}

// Call database initialization
initDatabase().catch(console.error);

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
};

// Routes

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all cards
app.get('/api/cards', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, title, date, fights FROM fight_cards ORDER BY created_at DESC');
    
    // Parse the fights JSON string back to an object
    const cards = result.rows.map(row => {
      return {
        id: row.id,
        title: row.title,
        date: row.date,
        fights: row.fights
      };
    });
    
    res.json(cards);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get latest card
app.get('/api/cards/latest', async (req, res) => { 
  try {
    const result = await pool.query('SELECT id, title, date, fights FROM fight_cards ORDER BY id DESC LIMIT 1');
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No fight cards found' });
    }
    
    const row = result.rows[0];
    
    // Parse the fights JSON string back to an object
    const card = {
      id: row.id,
      title: row.title,
      date: row.date,
      fights: row.fights
    };
    
    res.json(card);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get a specific card
app.get('/api/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT id, title, date, fights FROM fight_cards WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    const row = result.rows[0];
    
    // Parse the fights JSON string back to an object
    const card = {
      id: row.id,
      title: row.title,
      date: row.date,
      fights: row.fights
    };
    
    res.json(card);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get active card
app.get('/api/cards/active', async (req, res) => { 
  try {
    const { id } = req.query; // Changed from params to query
    
    if (!id) {
      return res.status(400).json({ error: 'ID parameter is required' });
    }
    
    const result = await pool.query('SELECT id, title, date, fights FROM fight_cards WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No fight cards found' });
    }
    
    const row = result.rows[0];
    
    // Parse the fights JSON string back to an object
    const card = {
      id: row.id,
      title: row.title,
      date: row.date,
      fights: row.fights
    };
    
    res.json(card);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create a new card
app.post('/api/cardsCreate', async (req, res) => {
  try {
    const { title, date, fights } = req.body;
    
    if (!title || !date || !fights) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      'INSERT INTO fight_cards (title, date, fights) VALUES ($1, $2, $3) RETURNING id',
      [title, date, JSON.stringify(fights)]
    );
    
    res.status(201).json({
      id: result.rows[0].id,
      title,
      date,
      fights
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update an existing card
app.put('/api/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, fights } = req.body;
    
    if (!title || !date || !fights) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await pool.query(
      'UPDATE fight_cards SET title = $1, date = $2, fights = $3 WHERE id = $4 RETURNING *',
      [title, date, fights, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    res.json({
      id: parseInt(id),
      title,
      date,
      fights
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete a card
app.delete('/api/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM fight_cards WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    res.json({ message: 'Card deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get results for a specific card
app.get('/api/cards/:id/results', async (req, res) => {
  try {
    const cardId = req.params.id;
    
    const result = await pool.query('SELECT results FROM fight_cards WHERE id = $1', [cardId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    // Results are already a JSON object when using JSONB in PostgreSQL
    const results = result.rows[0].results || {};
    
    res.json({ results: results });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update results for a card
app.post('/api/cards/update-results', async (req, res) => {
  try {
    const { cardId, results } = req.body;
    
    if (!cardId || !results) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await pool.query(
      'UPDATE fight_cards SET results = $1 WHERE id = $2',
      [results, cardId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    res.json({ success: true, message: 'Results updated successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// AUTH ROUTES

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if email already exists
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Check if username already exists
    const usernameCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (usernameCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Insert new user
    await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
      [username, email, hashedPassword]
    );
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const result = await pool.query('SELECT id, username, password FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Set session data
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Handle remember me option
    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
    }
    
    res.json({ message: 'Login successful', username: user.username, userId: user.id });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error logging out' });
    }
    
    res.json({ message: 'Logout successful' });
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    const userId = result.rows[0].id;
    
    // Generate a random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Set token expiration to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    // Remove any existing tokens for this user
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    
    // Save new token
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, resetToken, expiresAt]
    );
    
    // In a real application, send an email with the reset link
    // For now, just return the token in the response
    res.json({ 
      message: 'Password reset link sent to email',
      // This would normally not be returned to the client
      resetToken,
      resetLink: `/auth.html?reset=${resetToken}`
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/save-new-password', async (req, res) => {
  try {
    const { resetToken, password } = req.body;
    
    if (!resetToken || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    
    // Get token information and check if it's valid
    const tokenResult = await pool.query(
      `SELECT user_id, expires_at FROM password_reset_tokens 
       WHERE token = $1 AND expires_at > NOW()`,
      [resetToken]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    
    const tokenInfo = tokenResult.rows[0];
    
    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Update user's password
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, tokenInfo.user_id]
    );
    
    // Delete the used token
    await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [resetToken]);
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Save new password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Protected route example
app.get('/api/user/profile', isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  const isAuthenticated = !!(req.session && req.session.userId);
  res.json({ 
    authenticated: isAuthenticated,
    username: isAuthenticated ? req.session.username : null
  });
});

// Check if event has started
app.get('/api/event/start/:eventTitle', requireAuth, async (req, res) => {
  try {
    const { eventTitle } = req.params;
    
    const result = await pool.query(
      'SELECT results FROM fight_cards WHERE title = $1',
      [eventTitle]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ 
      exists: result.rows[0].results != null, 
      eventresults: result.rows 
    });
  } catch (err) {
    console.error('Error checking event start:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error when checking event start' 
    });
  }
});

// Middleware for requiring auth
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  next();
}

// Check if user has already submitted bets for this event
app.get('/api/bets/check/:eventTitle', requireAuth, async (req, res) => {
  try {
    const { eventTitle } = req.params;
    const username = req.session.username;
    
    const result = await pool.query(
      'SELECT id FROM user_bets WHERE username = $1 AND event_name = $2',
      [username, eventTitle]
    );
    
    res.json({ 
      exists: result.rows.length > 0, 
      bets: result.rows 
    });
  } catch (err) {
    console.error('Error checking existing bets:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error when checking existing bets' 
    });
  }
});

// Submit bets
app.post('/api/bets/submit', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const username = req.session.username;
    const { eventTitle } = req.body;
    
    if (!eventTitle) {
      return res.status(400).json({
        success: false,
        message: 'Event title is required'
      });
    }
    
    // Convert the entire request body to a JSON object to store
    const betsJson = req.body;
    
    await pool.query(
      'INSERT INTO user_bets (user_id, username, event_name, json_data) VALUES ($1, $2, $3, $4)',
      [userId, username, eventTitle, betsJson]
    );
    
    res.json({
      success: true,
      message: 'Bets submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting bets:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error when submitting bets' 
    });
  }
});

// Update existing bets
app.post('/api/bets/update', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const username = req.session.username;
    const { eventTitle } = req.body;
    
    // Check if required data is present
    if (!eventTitle) {
      return res.status(400).json({
        success: false,
        message: 'Event title is required'
      });
    }
    
    // Convert the entire request body to a JSON object to store
    const betsJson = req.body;
    
    const result = await pool.query(
      'UPDATE user_bets SET json_data = $1 WHERE user_id = $2 AND username = $3 AND event_name = $4',
      [betsJson, userId, username, eventTitle]
    );
    
    // Check if any row was actually updated
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No existing bets found to update for this event'
      });
    }
    
    res.json({
      success: true,
      message: 'Bets updated successfully',
      updated: result.rowCount
    });
  } catch (error) {
    console.error('Error updating bets:', error);
    res.status(500).json({
      success: false,
      message: 'Server error when updating bets'
    });
  }
});

app.get('/api/bets/card/:cardId', async (req, res) => {
  try {
    const cardId = parseInt(req.params.cardId);
    
    if (isNaN(cardId)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }
    
    // With PostgreSQL, we can use JSONB operators to filter
    const result = await pool.query(`
      SELECT id, json_data, results_data 
      FROM user_bets
      WHERE (json_data->>'cardId')::int = $1 OR 
            json_data->'confidenceOrder' IS NOT NULL
    `, [cardId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({ error: 'Failed to fetch user bets' });
  }
});

// Update bet results
app.post('/api/bets/update-results', async (req, res) => {
  try {
    const { betId, betResults } = req.body;
    
    if (!betId || !betResults) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const tokenResults = parseInt(betResults.totalWinnings);
    
    const result = await pool.query(
      'UPDATE user_bets SET results_data = $1, tokens = $2 WHERE id = $3',
      [betResults, tokenResults, betId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Bet not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Bet results updated successfully',
      betId: betId
    });
  } catch (error) {
    console.error('Error updating bet results:', error);
    res.status(500).json({ error: 'Failed to update bet results' });
  }
});

// Get event details and results
app.get('/api/event-results/:eventTitle', async (req, res) => {
  try {
    const eventTitle = req.params.eventTitle;
    
    const result = await pool.query(
      'SELECT title, fights, results FROM fight_cards WHERE title = $1',
      [eventTitle]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const row = result.rows[0];
    
    return res.json({
      title: row.title,
      fights: row.fights,
      results: row.results
    });
  } catch (error) {
    console.error('Error fetching event results:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user bets and results for a specific event
app.get('/api/user-bets/:username/:eventName', async (req, res) => {
  try {
    const { username, eventName } = req.params;
    
    const result = await pool.query(
      'SELECT json_data, results_data FROM user_bets WHERE username = $1 AND event_name = $2',
      [username, eventName]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No bets/results found for this user and event' });
    }
    
    return res.json({
      bets: result.rows[0].json_data,
      results: result.rows[0].results_data
    });
  } catch (error) {
    console.error('Error fetching user bets:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user results for a specific event
app.get('/api/user-results/:username/:eventName', async (req, res) => {
  try {
    const { username, eventName } = req.params;
    
    const result = await pool.query(
      'SELECT results_data FROM user_bets WHERE username = $1 AND event_name = $2',
      [username, eventName]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No results found for this user and event' });
    }
    
    return res.json(result.rows[0].results_data);
  } catch (error) {
    console.error('Error fetching user results:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get list of all events
app.get('/api/events/list', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT event_name FROM user_bets');
    res.json({ events: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error fetching events list' });
  }
});

app.get('/api/cardsAll/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, date 
      FROM fight_cards 
      ORDER BY date DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all cards:', error);
    res.status(500).json({ error: 'Failed to fetch all cards' });
  }
});

// Get a specific fight card by ID
app.get('/api/cardsId/:id', async (req, res) => {
  try {
    const cardId = req.params.id;
    
    const result = await pool.query('SELECT * FROM fight_cards WHERE id = $1', [cardId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    const card = result.rows[0];
    
    // Parse the JSON string into an object
    const cardData = {
      id: card.id,
      title: card.title,
      date: card.date,
      fights: card.fights
    };
    
    res.json(cardData);
  } catch (error) {
    console.error('Error fetching card by ID:', error);
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

// Get users who placed bets for a specific event
app.get('/api/event-users/:eventTitle', async (req, res) => {
  try {
    const eventTitle = req.params.eventTitle;
    
    const result = await pool.query(`
      SELECT DISTINCT username 
      FROM user_bets 
      WHERE event_name = $1
    `, [eventTitle]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users for event:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/leaderboard/:eventTitle', async (req, res) => {
  try {
    const eventTitle = req.params.eventTitle;
    
    const result = await pool.query(`
      SELECT username, results_data 
      FROM user_bets 
      WHERE event_name = $1 AND results_data IS NOT NULL
    `, [eventTitle]);
    
    // Create leaderboard data
    const leaderboard = result.rows.map(user => {
      const resultData = JSON.parse(JSON.stringify(user.results_data));
      return {
        username: user.username,
        tokens: resultData.totalWinnings || 0
      };
    });
    
    // Sort by tokens (highest first)
    leaderboard.sort((a, b) => b.tokens - a.tokens);
    
    res.json(leaderboard);
    
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/schedule', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT event, date, time 
      FROM fight_schedule 
      ORDER BY date ASC
    `);
    
    // Format date strings for consistency if needed
    const formattedRows = result.rows.map(row => {
      // Ensure date is in ISO format (YYYY-MM-DD)
      if (row.date && !isNaN(new Date(row.date).getTime())) {
        row.date = new Date(row.date).toISOString().split('T')[0];
      }
      return row;
    });
    
    res.json(formattedRows);
    
  } catch (error) {
    console.error('Error fetching schedule data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Catch-all route to serve the main html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
