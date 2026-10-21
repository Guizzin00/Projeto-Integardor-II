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
    email_secundario = db.Column(db.String(120), nullable=True)
    interesses = db.Column(db.String(300), nullable=True, default='')
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    status_aprovacao = db.Column(db.String(20), nullable=False, default='APROVADO')  # 'PENDENTE', 'APROVADO', 'REJEITADO'
    data_cadastro = db.Column(db.DateTime, default=datetime.utcnow)
    email_verificado = db.Column(db.Boolean, nullable=False, default=True)

    def to_dict(self):
        status_aprov = getattr(self, 'status_aprovacao', 'APROVADO') or 'APROVADO'
        dt_cad = getattr(self, 'data_cadastro', None)
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "email": self.email,
            "email_secundario": getattr(self, 'email_secundario', None) or "",
            "bio": self.bio or "",
            "interesses": self.interesses or "",
            "ativo": bool(self.ativo),
            "status_aprovacao": status_aprov,
            "data_cadastro": dt_cad.isoformat() if dt_cad else None
        }

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
    concluido_em = db.Column(db.DateTime, nullable=True)
    orientador = db.relationship('User', foreign_keys=[professor_id], lazy='joined', backref=db.backref('projetos_orientados', lazy=True)) 

    def to_dict(self):
        detalhes_val = []
        if self.detalhes:
            try:
                detalhes_val = json.loads(self.detalhes)
            except Exception:
                detalhes_val = [{"titulo": "Detalhes", "conteudo": str(self.detalhes)}]
                
        links_val = {}
        if self.links:
            try:
                links_val = json.loads(self.links)
            except Exception:
                links_val = {}

        cands_aprovadas = 0
        try:
            if hasattr(self, 'candidaturas') and self.candidaturas:
                cands_aprovadas = len([c for c in self.candidaturas if c.status == 'APROVADA'])
        except Exception:
            cands_aprovadas = 0

        orientador_info = None
        try:
            if self.orientador:
                orientador_info = {"id": self.orientador.id, "username": self.orientador.username}
        except Exception:
            orientador_info = None

        return {
            "id": self.id,
            "titulo": self.titulo,
            "status": self.status,
            "professor": self.professor,
            "categoria": self.categoria,
            "descricao_curta": self.descricao_curta,
            "imagem": self.imagem,
            "detalhes": detalhes_val,
            "links": links_val,
            "owner_username": self.owner_username,
            "tags": self.tags or "",
            "professor_id": self.professor_id,
            "orientador": orientador_info,
            "candidaturas_aprovadas": cands_aprovadas
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
    projeto_id = db.Column(db.Integer, nullable=True)  # projeto criado a partir desta proposta

    def to_dict(self):
        return {
            "id": self.id,
            "nome_projeto": self.nome_projeto,
            "categoria": self.categoria,
            "descricao": self.descricao,
            "proponente": self.proponente,
            "email": self.email,
            "status": self.status,
            "username": self.username,
            "imagem": self.imagem,
            "tags": self.tags or "",
            "projeto_id": self.projeto_id
        }

class Application(db.Model):
    __table_args__ = (db.UniqueConstraint('projeto_id', 'username', name='uq_application_projeto_username'),)
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    username = db.Column(db.String(50), nullable=False)
    motivo = db.Column(db.Text, nullable=False)
    experiencia = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), nullable=False, default='PENDENTE')
    
    projeto = db.relationship('Project', backref=db.backref('candidaturas', lazy='selectin'))

    def to_dict(self):
        return {
            "id": self.id,
            "projeto_id": self.projeto_id,
            "projeto": {"id": self.projeto.id, "titulo": self.projeto.titulo} if self.projeto else None,
            "username": self.username,
            "motivo": self.motivo,
            "experiencia": self.experiencia,
            "status": self.status
        }

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

class AccountVerification(db.Model):
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

    def to_dict(self):
        checklist_val = []
        if self.checklist:
            try:
                checklist_val = json.loads(self.checklist)
            except Exception:
                checklist_val = []
        return {
            "id": self.id,
            "projeto_id": self.projeto_id,
            "titulo": self.titulo,
            "descricao": self.descricao or "",
            "status": self.status,
            "assigned_username": self.assigned_username or "",
            "deadline": self.deadline.strftime('%Y-%m-%d') if self.deadline else "",
            "checklist": checklist_val,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }
