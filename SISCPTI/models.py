# -------------------------------------------------------------------
# SisCPTI - Sistema de Gestão do Caderno de Projetos de TI
# Copyright (c) 2026 Equipe SisCPTI (CEUB). Todos os direitos reservados.
# Autores: Arthur Grangeiro, Davi Souza, Guilherme Gouveia,
#          Guilherme Oliveira Ribeiro Soares
# Software proprietário. Uso, cópia ou distribuição proibidos sem
# autorização dos autores. Ver arquivo LICENSE.
# -------------------------------------------------------------------

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
    matricula = db.Column(db.String(30), unique=True, nullable=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')
    email = db.Column(db.String(120), unique=True, nullable=False)
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
            "matricula": getattr(self, 'matricula', None) or "",
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
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL'), nullable=True, index=True)
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
            if isinstance(self.links, dict):
                links_val = self.links
            elif isinstance(self.links, list):
                for item in self.links:
                    if isinstance(item, dict):
                        n = (item.get('nome') or item.get('titulo') or item.get('label') or 'Link').strip()
                        u = (item.get('url') or item.get('href') or '').strip()
                        if u:
                            links_val[n] = u
                    elif isinstance(item, str) and item.strip():
                        links_val[item.strip()] = item.strip()
            elif isinstance(self.links, str):
                try:
                    parsed = json.loads(self.links)
                    if isinstance(parsed, dict):
                        links_val = parsed
                    elif isinstance(parsed, list):
                        for item in parsed:
                            if isinstance(item, dict):
                                n = (item.get('nome') or item.get('titulo') or item.get('label') or 'Link').strip()
                                u = (item.get('url') or item.get('href') or '').strip()
                                if u:
                                    links_val[n] = u
                            elif isinstance(item, str) and item.strip():
                                links_val[item.strip()] = item.strip()
                    elif isinstance(parsed, str) and parsed.strip():
                        links_val = {"Link": parsed.strip()}
                except Exception:
                    if self.links.strip().startswith(('http://', 'https://')):
                        links_val = {"Link": self.links.strip()}
                    else:
                        links_val = {}

        # Contagem de membros e candidaturas aprovadas
        cands_aprovadas = 0
        membros_set = set()
        if self.owner_username and self.owner_username.strip():
            membros_set.add(self.owner_username.strip().lower())

        try:
            from models import Application
            cand_list = []
            if hasattr(self, 'candidaturas') and self.candidaturas is not None:
                cand_list = self.candidaturas
            elif self.id:
                cand_list = Application.query.filter_by(projeto_id=self.id).all()

            for c in cand_list:
                st = (c.status or '').strip().upper()
                if st in ('APROVADA', 'APROVADO'):
                    cands_aprovadas += 1
                    if c.username and c.username.strip():
                        membros_set.add(c.username.strip().lower())
        except Exception:
            try:
                from models import Application
                if self.id:
                    cands_aprovadas = Application.query.filter(
                        Application.projeto_id == self.id,
                        db.or_(Application.status == 'APROVADA', Application.status == 'APROVADO')
                    ).count()
            except Exception:
                cands_aprovadas = 0

        # Total de integrantes da equipe (líder do projeto + estudantes com candidatura aprovada)
        total_integrantes = len(membros_set)
        if total_integrantes == 0:
            total_integrantes = (1 if self.owner_username else 0) + cands_aprovadas
        if total_integrantes == 0 and (self.owner_username or self.id):
            total_integrantes = 1

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
            "professor": (orientador_info["username"] if orientador_info else (self.professor or "")),
            "categoria": self.categoria,
            "descricao_curta": self.descricao_curta,
            "imagem": self.imagem,
            "detalhes": detalhes_val,
            "links": links_val,
            "owner_username": self.owner_username,
            "tags": self.tags or "",
            "professor_id": self.professor_id,
            "orientador": orientador_info,
            "candidaturas_aprovadas": cands_aprovadas,
            "total_integrantes": total_integrantes
        }

class Submission(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL'), nullable=True, index=True)
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
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL'), nullable=True, index=True)
    __table_args__ = (db.UniqueConstraint('projeto_id', 'username', name='uq_application_projeto_username'),)
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    username = db.Column(db.String(50), nullable=False)
    motivo = db.Column(db.Text, nullable=False)
    experiencia = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), nullable=False, default='PENDENTE')
    
    projeto = db.relationship('Project', backref=db.backref('candidaturas', lazy='selectin', cascade='all, delete-orphan'))

    def to_dict(self):
        candidato_user = None
        try:
            if self.user_id:
                candidato_user = User.query.get(self.user_id)
            elif self.username:
                candidato_user = User.query.filter_by(username=self.username).first()
        except Exception:
            candidato_user = None

        return {
            "id": self.id,
            "projeto_id": self.projeto_id,
            "projeto": {"id": self.projeto.id, "titulo": self.projeto.titulo} if self.projeto else None,
            "username": self.username,
            "nome": candidato_user.username if candidato_user else self.username,
            "email": candidato_user.email if candidato_user else "",
            "matricula": getattr(candidato_user, 'matricula', None) or "",
            "motivo": self.motivo,
            "experiencia": self.experiencia,
            "status": self.status
        }

class Message(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL'), nullable=True, index=True)
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    username = db.Column(db.String(50), nullable=False)
    texto = db.Column(db.Text, nullable=True)
    arquivo = db.Column(db.String(200), nullable=True)
    data_envio = db.Column(db.DateTime, default=datetime.utcnow)
    
    projeto = db.relationship('Project', backref=db.backref('mensagens', lazy=True, cascade='all, delete-orphan'))

class Notification(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL'), nullable=True, index=True)
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    mensagem = db.Column(db.Text, nullable=False)
    lida = db.Column(db.Boolean, nullable=False, default=False)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    link = db.Column(db.String(200), nullable=True)

class Rating(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL'), nullable=True, index=True)
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    username = db.Column(db.String(50), nullable=False)
    nota = db.Column(db.Integer, nullable=False)  # 1-5
    nota_organizacao = db.Column(db.Integer, nullable=True, default=5)
    nota_orientacao = db.Column(db.Integer, nullable=True, default=5)
    nota_aprendizado = db.Column(db.Integer, nullable=True, default=5)
    comentario = db.Column(db.Text, nullable=True)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    projeto = db.relationship('Project', backref=db.backref('avaliacoes', lazy=True, cascade='all, delete-orphan'))

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
    assigned_user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL'), nullable=True, index=True)
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
    
    projeto = db.relationship('Project', backref=db.backref('tasks', lazy=True, cascade='all, delete-orphan'))

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


# =========================
# Vínculos por id: preenche o id do usuário sempre que só o nome for informado
# =========================
from sqlalchemy import event, select

_VINCULOS = {
    'Application': [('username', 'user_id')],
    'Message': [('username', 'user_id')],
    'Notification': [('username', 'user_id')],
    'Rating': [('username', 'user_id')],
    'Submission': [('username', 'user_id')],
    'Task': [('assigned_username', 'assigned_user_id')],
    'Project': [('owner_username', 'owner_id')],
}


def _preencher_ids(mapper, connection, target):
    for campo_nome, campo_id in _VINCULOS[type(target).__name__]:
        nome = getattr(target, campo_nome, None)
        if nome and getattr(target, campo_id, None) is None:
            setattr(target, campo_id, connection.execute(select(User.id).where(User.username == nome)).scalar())


for _modelo in (Application, Message, Notification, Rating, Submission, Task, Project):
    event.listen(_modelo, 'before_insert', _preencher_ids)
