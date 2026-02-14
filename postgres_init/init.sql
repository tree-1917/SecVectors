DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS tickets;

CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    subject TEXT,
    issue TEXT,
    customer_sentiment TEXT,
    namespace TEXT,
    status TEXT DEFAULT 'open', -- 'open' or 'closed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT, -- 'analyst' or 'admin'
    namespace TEXT, -- For analysts
    credit_card TEXT -- For admins
);

INSERT INTO users (username, password, role, namespace, credit_card) VALUES 
('analyst1', 'password123', 'analyst', 'network-dept', NULL),
('analysist1', 'password123', 'analyst', 'network-dept', NULL),
('analyst2', 'password456', 'analyst', 'db-dept', NULL),
('admin', 'Sup3rS3cur3P@ssw0rd!', 'admin', 'global', '4111-2222-3333-4444');

INSERT INTO tickets (subject, issue, customer_sentiment, namespace, status) VALUES
('Slow Network', 'The internet is slow in the lounge.', 'Frustrated', 'network-dept', 'open'),
('Database Down', 'Cannot connect to production DB.', 'Frustrated', 'db-dept', 'closed'),
('VPN Issue', 'VPN disconnects every 5 minutes.', 'Neutral', 'network-dept', 'open');
