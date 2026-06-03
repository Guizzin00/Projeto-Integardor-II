import os
import sys

# Add SISCPTI folder to python path
sys.path.append(os.path.join(os.path.dirname(__file__), '../SISCPTI'))

from app import app
from models import db, Submission, Project

with app.test_client() as client:
    with client.session_transaction() as sess:
        sess['role'] = 'admin'
        sess['user'] = 'admin'
        sess['logged_in'] = True

    print("Hitting route for submission 4...")
    res = client.get('/admin/submissao/4/reavaliar?ajax=1')
    print(f"Status code: {res.status_code}")
    print(f"Data: {res.data.decode('utf-8', errors='ignore')}")

    print("Hitting route for submission 7...")
    res = client.get('/admin/submissao/7/reavaliar?ajax=1')
    print(f"Status code: {res.status_code}")
    print(f"Data: {res.data.decode('utf-8', errors='ignore')}")
