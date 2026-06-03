import sys
sys.path.append('SISCPTI')
from app import app

with app.test_client() as client:
    with client.session_transaction() as sess:
        sess['logged_in'] = True
        sess['user'] = 'admin'
        sess['role'] = 'admin'
    
    # Test listing tasks for project 4
    res = client.get('/api/projeto/4/tasks')
    print("Status code:", res.status_code)
    print("Response data:", res.data.decode('utf-8'))
