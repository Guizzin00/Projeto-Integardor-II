# -------------------------------------------------------------------
# SisCPTI - Sistema de Gestão do Caderno de Projetos de TI
# Copyright (c) 2026 Equipe SisCPTI (CEUB). Todos os direitos reservados.
# Autores: Arthur Grangeiro, Davi Souza, Guilherme Gouveia,
#          Guilherme Oliveira Ribeiro Soares
# Software proprietário. Uso, cópia ou distribuição proibidos sem
# autorização dos autores. Ver arquivo LICENSE.
# -------------------------------------------------------------------

import os
import sys

# Banco em memória e ambiente de desenvolvimento para os testes
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ.pop('VERCEL', None)
os.environ.setdefault('SECRET_KEY', 'chave-de-teste')
os.environ['MAIL_SYNC'] = '1'

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import tempfile

import pytest
from werkzeug.security import generate_password_hash

import utils
from app import app as flask_app
from models import db, User, Project, Application

SENHA = 'Senha1234'
flask_app.config['UPLOAD_FOLDER'] = tempfile.mkdtemp(prefix='siscpti_uploads_')


@pytest.fixture()
def app_ctx():
    with flask_app.app_context():
        db.drop_all()
        db.create_all()
        utils._tentativas.clear()
        yield flask_app
        db.session.remove()


def criar_usuario(username, role='aluno', **extra):
    u = User(username=username, email=f'{username}@ceub.br', password=generate_password_hash(SENHA),
             role=role, ativo=True, **extra)
    db.session.add(u)
    db.session.commit()
    return u


def criar_projeto(owner='dono', status='EM EXECUÇÃO', professor_id=None):
    p = Project(titulo='Projeto', status=status, professor='Prof', categoria='c', descricao_curta='d',
                detalhes='[]', owner_username=owner, professor_id=professor_id)
    db.session.add(p)
    db.session.commit()
    return p


def aprovar(projeto, username):
    db.session.add(Application(projeto_id=projeto.id, username=username, motivo='m', experiencia='e', status='APROVADA'))
    db.session.commit()


def logar(username):
    client = flask_app.test_client()
    r = client.post('/api/login', json={'user': username, 'password': SENHA})
    assert r.status_code == 200, r.get_json()
    return client


@pytest.fixture()
def cenario(app_ctx):
    """Projeto com dono, orientador, membro aprovado, aluno de fora, líder de fora, cliente, admin e coordenador."""
    prof = criar_usuario('prof', 'professor')
    criar_usuario('dono', 'empresa')
    criar_usuario('membro', 'aluno')
    criar_usuario('fora', 'aluno')
    criar_usuario('lider.fora', 'lider')
    criar_usuario('cliente', 'cliente')
    criar_usuario('admin', 'admin')
    criar_usuario('coord', 'coordenador')
    proj = criar_projeto(professor_id=prof.id)
    aprovar(proj, 'membro')
    return proj
