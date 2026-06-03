import os
import sys

# Add SISCPTI folder to python path
sys.path.append(os.path.join(os.path.dirname(__file__), '../SISCPTI'))

from app import app
from models import db, Submission, Project

with app.app_context():
    print("Testing reavaliar for all submissions...")
    submissions = Submission.query.all()
    for s in submissions:
        print(f"Sub ID: {s.id}, Title: {s.nome_projeto}, Status: {s.status}, Owner: {s.username}")
        try:
            # Simulate the reavaliar query
            proj = Project.query.filter_by(titulo=s.nome_projeto, owner_username=s.username).first()
            print(f"  Associated Project found: {proj.id if proj else 'None'}")
        except Exception as e:
            print(f"  Error querying project: {e}")
