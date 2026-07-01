import os
import http.server
import socketserver
import webbrowser
import threading
from http.server import SimpleHTTPRequestHandler

PORT = 9015

# Klasa, która pozwala serwować pliki z dwóch różnych miejsc
class MyHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Jeśli ścieżka zaczyna się od /data, szukaj w folderze 'data'
        if path.startswith('/data'):
            return os.path.join(os.getcwd(), path[1:])
        # W przeciwnym razie szukaj w folderze 'web'
        return os.path.join(os.getcwd(), 'web', path[1:])

def start_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        print(f"Serwer działa na http://localhost:{PORT}")
        httpd.serve_forever()

# Uruchomienie serwera w tle
threading.Thread(target=start_server, daemon=True).start()

# Automatyczne otwarcie strony
webbrowser.open(f'http://localhost:{PORT}/index.html')

input("Wciśnij Enter, aby zamknąć...\n")