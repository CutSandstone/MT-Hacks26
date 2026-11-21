"""Regression tests for the static server."""
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server  # noqa: E402


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def url(self, p):
        return f'http://127.0.0.1:{self.port}{p}'

    def test_env_and_dotfiles_not_served(self):
        for path in ('/.env', '/.git/config', '/.env.example', '/.gitignore'):
            try:
                urllib.request.urlopen(self.url(path), timeout=10)
                self.fail(f'{path} was served')
            except urllib.error.HTTPError as e:
                self.assertEqual(e.code, 404, path)

    def test_index_served(self):
        with urllib.request.urlopen(self.url('/index.html'), timeout=10) as r:
            self.assertEqual(r.status, 200)
            self.assertIn(b'<', r.read(200))

    def test_status_endpoint_is_not_served(self):
        with self.assertRaises(urllib.error.HTTPError) as exc:
            urllib.request.urlopen(self.url('/api/status'), timeout=10)
        self.assertEqual(exc.exception.code, 404)

    def test_server_does_not_accept_api_posts(self):
        for path in ('/api/ask', '/api/interpret'):
            with self.subTest(path=path):
                req = urllib.request.Request(self.url(path), data=b'{}', method='POST')
                with self.assertRaises(urllib.error.HTTPError) as exc:
                    urllib.request.urlopen(req, timeout=10)
                self.assertEqual(exc.exception.code, 501)


if __name__ == '__main__':
    unittest.main()
