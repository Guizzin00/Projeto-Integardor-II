from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

# =========================
# Modelos
# =========================
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')
    email = db.Column(db.String(120), nullable=True)
    bio = db.Column(db.String(300), nullable=True)
    interesses = db.Column(db.String(300), nullable=True, default='')

import random

def get_random_default_cover():
    return random.choice(['default_capa_1.jpg', 'default_capa_2.jpg', 'default_capa_3.jpg'])

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    professor = db.Column(db.String(100), nullable=False)
    categoria = db.Column(db.String(100), nullable=False)
    descricao_curta = db.Column(db.String(500), nullable=False)
    imagem = db.Column(db.String(200), nullable=False, default=get_random_default_cover)
    detalhes = db.Column(db.Text, nullable=False) 
    links = db.Column(db.Text, nullable=False, default='{}')
    owner_username = db.Column(db.String(50), nullable=True) 
    professor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    tags = db.Column(db.String(300), nullable=True, default='')
    orientador = db.relationship('User', foreign_keys=[professor_id], backref=db.backref('projetos_orientados', lazy=True)) 

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "status": self.status,
            "professor": self.professor,
            "categoria": self.categoria,
            "descricao_curta": self.descricao_curta,
            "imagem": self.imagem,
            "detalhes": json.loads(self.detalhes),
            "links": json.loads(self.links) if self.links else {},
            "owner_username": self.owner_username
        }

class Submission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome_projeto = db.Column(db.String(200), nullable=False)
    categoria = db.Column(db.String(100), nullable=False)
    descricao = db.Column(db.Text, nullable=False)
    proponente = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), nullable=False, default='EM ANÁLISE')
    username = db.Column(db.String(50), nullable=True)
    imagem = db.Column(db.String(200), nullable=True)
    tags = db.Column(db.String(300), nullable=True, default='')

class Application(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    username = db.Column(db.String(50), nullable=False)
    motivo = db.Column(db.Text, nullable=False)
    experiencia = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), nullable=False, default='PENDENTE')
    
    projeto = db.relationship('Project', backref=db.backref('candidaturas', lazy=True))

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    username = db.Column(db.String(50), nullable=False)
    texto = db.Column(db.Text, nullable=True)
    arquivo = db.Column(db.String(200), nullable=True)
    data_envio = db.Column(db.DateTime, default=datetime.utcnow)
    
    projeto = db.relationship('Project', backref=db.backref('mensagens', lazy=True))

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    mensagem = db.Column(db.Text, nullable=False)
    lida = db.Column(db.Boolean, nullable=False, default=False)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    link = db.Column(db.String(200), nullable=True)

class Rating(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    username = db.Column(db.String(50), nullable=False)
    nota = db.Column(db.Integer, nullable=False)  # 1-5
    nota_organizacao = db.Column(db.Integer, nullable=True, default=5)
    nota_orientacao = db.Column(db.Integer, nullable=True, default=5)
    nota_aprendizado = db.Column(db.Integer, nullable=True, default=5)
    comentario = db.Column(db.Text, nullable=True)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    projeto = db.relationship('Project', backref=db.backref('avaliacoes', lazy=True))

class ActivityLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    acao = db.Column(db.String(100), nullable=False)
    detalhes = db.Column(db.Text, nullable=True)
    data = db.Column(db.DateTime, default=datetime.utcnow)

class PasswordReset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=False)
    expira_em = db.Column(db.DateTime, nullable=False)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    titulo = db.Column(db.String(150), nullable=False)
    descricao = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='todo') # todo, doing, done
    assigned_username = db.Column(db.String(50), nullable=True) # Aluno responsável
    deadline = db.Column(db.Date, nullable=True)
    checklist = db.Column(db.Text, nullable=True) # Armazena JSON string
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    projeto = db.relationship('Project', backref=db.backref('tasks', lazy=True))
