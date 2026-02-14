from flask import Flask, request, jsonify
import redis
import json
import os

app = Flask(__name__)
redis_host = os.getenv('REDIS_HOST', 'redis')
r = redis.Redis(host=redis_host, port=6379, db=0)

@app.route('/ticket', methods=['POST'])
def create_ticket():
    data = request.json
    subject = data.get('subject')
    issue = data.get('issue') # Vulnerable: No sanitization for XSS
    namespace = data.get('namespace', 'general') # New: Namespace support
    
    ticket = {
        'subject': subject,
        'issue': issue,
        'namespace': namespace
    }
    
    # Push to Redis list 'tickets'
    r.lpush('tickets', json.dumps(ticket))
    
    return jsonify({"status": "Ticket received", "namespace": namespace}), 201

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
