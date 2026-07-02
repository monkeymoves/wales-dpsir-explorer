#!/usr/bin/env python3
"""Minimal static server for the prototype. chdir to an absolute path FIRST so
os.getcwd() never touches the launcher's (inaccessible) working directory."""
import http.server
import os
import socketserver

ROOT = "/Users/lukemaggs/Desktop/Claude/WALES/prototype"
PORT = 5173

os.chdir(ROOT)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print("serving %s on http://127.0.0.1:%d" % (ROOT, PORT), flush=True)
    httpd.serve_forever()
