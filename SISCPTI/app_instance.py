from flask import Flask
import os
from models import db

app = Flask(__name__)
app.secret_key = "sisCPTI_secret_key"

db_url = os.environ.get('DATABASE_URL', 'sqlite:///siscpti.db')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

UPLOAD_FOLDER = os.path.join('static', 'img', 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Inicializa o banco de dados no app Flask
db.init_app(app)

from flask_socketio import SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")
