import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../SISCPTI')))

from app import app

with app.test_client() as client:
    res = client.get('/static/logoCEUB.png')
    print(f"logoCEUB.png: status={res.status_code}, content_length={len(res.data)}")
    
    res_css = client.get('/static/style.css')
    print(f"style.css: status={res_css.status_code}, content_length={len(res_css.data)}")
