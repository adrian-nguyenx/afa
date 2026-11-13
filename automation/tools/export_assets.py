"""Export the site's agent avatars and logo to PNG for the email digest (automation/assets/email/).

Nothing is redrawn: the page automation/tools/export-assets.html renders the avatars with the site's own
components/avatars.js and the logo from assets/img/logo.svg, then posts them here.

Run again whenever avatars.js or logo.svg change:
  1. serve the project:        python -m http.server 8082
  2. start this receiver:      python automation/tools/export_assets.py
  3. open in any browser:      http://localhost:8082/automation/tools/export-assets.html?sink=http://127.0.0.1:8090/save
The receiver listens on 127.0.0.1 only and exits after one successful save.
"""
import base64
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'automation' / 'assets' / 'email'
done = False


class Sink(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        global done
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        OUT.mkdir(parents=True, exist_ok=True)
        for dep, uri in data['avatars'].items():
            (OUT / f'avatar-{dep}.png').write_bytes(base64.b64decode(uri.split(',', 1)[1]))
        (OUT / 'logo.png').write_bytes(base64.b64decode(data['logo'].split(',', 1)[1]))
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(b'ok')
        print(f'Saved {len(data["avatars"])} avatars + logo to {OUT}', flush=True)
        done = True

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    srv = HTTPServer(('127.0.0.1', 8090), Sink)
    print('Waiting on http://127.0.0.1:8090/save …', flush=True)
    while not done:
        srv.handle_request()
