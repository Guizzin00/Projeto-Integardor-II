import sys
sys.path.append('SISCPTI')
from app import app
from models import Task, Project

with app.app_context():
    for p in Project.query.all():
        print(f"Project ID: {p.id}, Title: {p.titulo}")
    for t in Task.query.all():
        print(f"Task ID: {t.id}, Proj ID: {t.projeto_id}, Title: {t.titulo}")
