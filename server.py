#!/usr/bin/env python3
"""Serve the demo's static files without exposing hidden files."""
import os
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).parent


def load_env():
    env = dict(os.environ)
    envfile = ROOT / '.env'
    if envfile.exists():
        for line in envfile.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env.setdefault(k.strip(), v.strip())
    return env


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _path(self):
        return urllib.parse.urlparse(self.path).path

    def _forbidden_static(self):
        for seg in urllib.parse.unquote(self._path()).split('/'):
            if seg.startswith('.') or seg == '__pycache__':
                return True
        return False

    def send_head(self):
        if self._forbidden_static():
            self.send_error(404)
            return None
        return super().send_head()


if __name__ == '__main__':
    port = int(load_env().get('PORT', '8000'))
    print(f'Serving http://localhost:{port}')
    ThreadingHTTPServer(('', port), Handler).serve_forever()
