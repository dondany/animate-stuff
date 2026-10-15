#!/usr/bin/env python3
"""Serves the app over HTTPS on your Wi-Fi so an iPhone can open it.

iPhone Safari only allows the camera on https:// pages, so this makes a
self-signed certificate the first time it runs. Safari will warn about it:
tap "Show Details" -> "visit this website" once.

Usage: python3 serve.py [port]
"""
import functools
import http.server
import pathlib
import socket
import ssl
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
CERT_DIR = ROOT / ".cert"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8443


def local_ip():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("10.255.255.255", 1))  # no packet is sent; this just picks the Wi-Fi interface
        return s.getsockname()[0]


def ensure_cert(ip):
    cert, key = CERT_DIR / f"{ip}.pem", CERT_DIR / f"{ip}-key.pem"
    if not cert.exists():
        CERT_DIR.mkdir(exist_ok=True)
        subprocess.run(
            ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "365",
             "-keyout", str(key), "-out", str(cert), "-subj", "/CN=Animate local",
             "-addext", f"subjectAltName=IP:{ip},IP:127.0.0.1,DNS:localhost"],
            check=True, capture_output=True,
        )
    return cert, key


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    ip = local_ip()
    cert, key = ensure_cert(ip)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert, key)
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), functools.partial(Handler, directory=str(ROOT)))
    server.socket = ctx.wrap_socket(server.socket, server_side=True)
    print(f"Open on your iPhone (same Wi-Fi):  https://{ip}:{PORT}")
    print(f"Or on this Mac:                    https://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
