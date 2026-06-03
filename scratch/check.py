import sys
sys.path.append('SISCPTI')
from app import app
from models import Task

with app.app_context():
    tasks = Task.query.all()
    print(f"Total tasks: {len(tasks)}")
    for t in tasks:
        print(f"ID: {t.id}, Titulo: {t.titulo}, Status: {t.status}, Assigned: {t.assigned_username}, Deadline: {t.deadline}, Checklist: {repr(t.checklist)}")
