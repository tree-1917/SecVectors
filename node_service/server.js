const express = require('express');
const { Pool } = require('pg');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'vulnerable-session-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Only for demo over HTTP
        httpOnly: false // VULNERABLE: Allows script to read document.cookie
    }
}));
app.use(express.static('public'));

const pool = new Pool({
    user: 'user',
    host: process.env.POSTGRES_HOST || 'postgres',
    database: 'support_db',
    password: 'pass',
    port: 5432,
});

// Real-time updates simulation (Namespace filtered)
setInterval(async () => {
    // Simulating per-connection count would be better, but for simplicity:
    try {
        const res = await pool.query('SELECT COUNT(*) FROM tickets');
        io.emit('globalTicketCount', res.rows[0].count);
    } catch (err) {
        console.error('Error fetching ticket count', err);
    }
}, 3000);

// Analyst Login
app.post('/analyst/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2 AND role = $3', [username, password, 'analyst']);
        if (result.rows.length > 0) {
            req.session.analyst = result.rows[0];
            res.redirect('/index.html');
        } else {
            res.status(401).send('Invalid Analyst credentials');
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).send(`Database Error: ${err.message}`);
    }
});

// Analyst API - Displays tickets for their specific namespace (Vulnerable to XSS)
app.get('/api/tickets', async (req, res) => {
    if (!req.session.analyst) {
        return res.status(401).json({ error: 'Unauthorized. Login as analyst first.' });
    }
    try {
        const namespace = req.session.analyst.namespace;
        const result = await pool.query('SELECT * FROM tickets WHERE namespace = $1 ORDER BY id DESC', [namespace]);
        res.json({ tickets: result.rows, analyst: req.session.analyst });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin Login - Vulnerable to SQL Injection and requires Analyst Login
app.post('/admin/login', async (req, res) => {
    if (!req.session.analyst) {
        return res.status(403).send('<h1>Access Denied</h1><p>You must login as an Analyst first before attempting Admin login.</p><a href="/analyst_login.html">Analyst Login</a>');
    }

    const { username, password } = req.body;

    // VULNERABLE DIRECT STRING CONCATENATION
    const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}' AND role = 'admin'`;
    console.log("Executing Admin Query:", query);

    try {
        const result = await pool.query(query);
        if (result.rows.length > 0) {
            req.session.admin = result.rows[0];
            res.redirect('/admin_dashboard.html');
        } else {
            res.status(401).send('Invalid Admin credentials');
        }
    } catch (err) {
        res.status(500).send(`Database Error: ${err.message}`);
    }
});

// Admin Stats - Returns counts of analysts, open tickets, and closed tickets
app.get('/api/admin/stats', async (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized. Admin only.' });
    }
    try {
        const analystsCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'analyst'");
        const openTickets = await pool.query("SELECT COUNT(*) FROM tickets WHERE status = 'open'");
        const closedTickets = await pool.query("SELECT COUNT(*) FROM tickets WHERE status = 'closed'");

        res.json({
            analysts: parseInt(analystsCount.rows[0].count),
            openTickets: parseInt(openTickets.rows[0].count),
            closedTickets: parseInt(closedTickets.rows[0].count)
        });
    } catch (err) {
        res.status(500).json({ error: 'Database error fetching stats' });
    }
});

// Admin Credit - Returns or updates the admin's credit card info
app.get('/api/admin/credit', async (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized. Admin only.' });
    }
    try {
        const result = await pool.query("SELECT credit_card FROM users WHERE username = $1", [req.session.admin.username]);
        res.json({ credit_card: result.rows[0].credit_card });
    } catch (err) {
        res.status(500).json({ error: 'Database error fetching credit card' });
    }
});

app.post('/api/admin/credit', async (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized. Admin only.' });
    }
    const { credit_card } = req.body;
    try {
        await pool.query("UPDATE users SET credit_card = $1 WHERE username = $2", [credit_card, req.session.admin.username]);
        res.json({ status: 'Success' });
    } catch (err) {
        res.status(500).json({ error: 'Database error updating credit card' });
    }
});

// Analyst Profile - Returns sensitive data (username, password)
app.get('/api/analyst/profile', (req, res) => {
    if (!req.session.analyst) {
        return res.status(401).json({ error: 'Unauthorized. Login as analyst first.' });
    }
    res.json({
        username: req.session.analyst.username,
        password: req.session.analyst.password,
        role: req.session.analyst.role,
        namespace: req.session.analyst.namespace
    });
});

// Check Session Status for UI
app.get('/api/session', (req, res) => {
    res.json({
        isAnalyst: !!req.session.analyst,
        isAdmin: !!req.session.admin,
        analyst: req.session.analyst
    });
});

server.listen(3000, () => {
    console.log('Node.js Dashboard running on port 3000');
});
