# -------------------------------------------------------------------
# SisCPTI - Sistema de Gestão do Caderno de Projetos de TI
# Copyright (c) 2026 Equipe SisCPTI (CEUB). Todos os direitos reservados.
# Autores: Arthur Grangeiro, Davi Souza, Guilherme Gouveia,
#          Guilherme Oliveira Ribeiro Soares
# Software proprietário. Uso, cópia ou distribuição proibidos sem
# autorização dos autores. Ver arquivo LICENSE.
# -------------------------------------------------------------------

import io

from conftest import SENHA, criar_projeto, criar_usuario, logar, aprovar
from app import app as flask_app
from models import db, Application, Project, Submission, Task, User


# ---------- #29 / #30: Kanban e permissões por projeto
def test_kanban_criar_editar_excluir(cenario):
    c = logar('membro')
    r = c.post(f'/api/projeto/{cenario.id}/tasks/criar', json={'titulo': 'T', 'checklist': [{'t': 'x'}]})
    assert r.status_code == 200
    tid = r.get_json()['task']['id']
    assert c.post(f'/api/projeto/{cenario.id}/tasks/{tid}/editar', json={'titulo': 'T2', 'checklist': []}).status_code == 200
    r = c.post(f'/api/projeto/{cenario.id}/tasks/criar', json={'titulo': 'sem checklist'})
    assert r.status_code == 200


def test_lider_de_fora_nao_altera_tarefas(cenario):
    dono = logar('dono')
    tid = dono.post(f'/api/projeto/{cenario.id}/tasks/criar', json={'titulo': 'T'}).get_json()['task']['id']
    lider = logar('lider.fora')
    assert lider.post(f'/api/projeto/{cenario.id}/tasks/criar', json={'titulo': 'x'}).status_code == 403
    assert lider.post(f'/api/projeto/{cenario.id}/tasks/{tid}/excluir').status_code == 403


def test_cliente_de_fora_nao_lista_tarefas(cenario):
    assert logar('cliente').get(f'/api/projeto/{cenario.id}/tasks').status_code == 403
    assert logar('membro').get(f'/api/projeto/{cenario.id}/tasks').status_code == 200


# ---------- #31: CORS / CSRF
def test_origem_cruzada_e_bloqueada(cenario):
    c = flask_app.test_client()
    r = c.post('/api/login', json={'user': 'a', 'password': 'b'}, headers={'Origin': 'https://evil.example'})
    assert r.status_code == 403
    r = c.get('/api/me', headers={'Origin': 'https://evil.example'})
    assert 'Access-Control-Allow-Origin' not in r.headers


# ---------- #32: migração e erros
def test_migrate_exige_admin(cenario):
    assert flask_app.test_client().post('/api/migrate-db').status_code == 403
    assert logar('membro').post('/api/migrate-db').status_code == 403
    assert flask_app.test_client().get('/api/health').get_json().keys() == {'status', 'message'}


# ---------- #34: upload
def test_upload_recusa_html(cenario):
    c = logar('membro')
    dados = {'texto': 'oi', 'arquivo': (io.BytesIO(b'<script>1</script>'), 'x.html')}
    r = c.post(f'/api/projeto/{cenario.id}/workspace/enviar', data=dados, content_type='multipart/form-data')
    assert r.status_code == 400


def test_upload_aceita_pdf(cenario):
    c = logar('membro')
    dados = {'texto': 'oi', 'arquivo': (io.BytesIO(b'%PDF-1.4'), 'x.pdf')}
    r = c.post(f'/api/projeto/{cenario.id}/workspace/enviar', data=dados, content_type='multipart/form-data')
    assert r.status_code == 200


# ---------- #35: candidatura
def test_candidatura_validacoes(cenario):
    aluno = logar('fora')
    url = f'/api/projeto/{cenario.id}/candidatar'
    assert aluno.post(url, json={}).status_code == 400
    assert aluno.post(url, json={'motivo': 'm', 'experiencia': 'e'}).status_code == 200
    assert aluno.post(url, json={'motivo': 'm', 'experiencia': 'e'}).status_code == 409
    assert logar('dono').post(url, json={'motivo': 'm', 'experiencia': 'e'}).status_code == 403


def test_candidatura_projeto_concluido(app_ctx):
    criar_usuario('a1')
    p = criar_projeto(status='CONCLUÍDO')
    assert logar('a1').post(f'/api/projeto/{p.id}/candidatar', json={'motivo': 'm', 'experiencia': 'e'}).status_code == 400


# ---------- #36: orientador e coordenador
def test_orientador_e_coordenador_no_workspace(cenario):
    db.session.add(Application(projeto_id=cenario.id, username='fora', motivo='m', experiencia='e'))
    db.session.commit()
    cand = Application.query.filter_by(username='fora').first()
    for u in ('prof', 'coord'):
        c = logar(u)
        assert c.get(f'/api/projeto/{cenario.id}/workspace').status_code == 200
        assert c.get(f'/api/projeto/{cenario.id}/workspace/mensagens').status_code == 200
    assert logar('prof').post(f'/api/candidatura/{cand.id}/aprovar').status_code == 200
    assert logar('fora').get(f'/api/projeto/{cenario.id}/workspace/mensagens').status_code == 200


# ---------- #37: proposta
def test_aprovar_proposta_duas_vezes(cenario):
    s = Submission(nome_projeto='Nova', categoria='c', descricao='d', proponente='Empresa', email='e@e.com',
                   username='dono')
    db.session.add(s)
    db.session.commit()
    adm = logar('admin')
    assert adm.post(f'/api/admin/submissao/{s.id}/aprovar').status_code == 200
    assert adm.post(f'/api/admin/submissao/{s.id}/aprovar').status_code == 409
    assert Project.query.filter_by(titulo='Nova').count() == 1
    assert Project.query.filter_by(titulo='Nova').first().professor == ''


def test_reavaliar_bloqueia_projeto_com_dados(cenario):
    s = Submission(nome_projeto='Nova', categoria='c', descricao='d', proponente='E', email='e@e.com', username='dono')
    db.session.add(s)
    db.session.commit()
    adm = logar('admin')
    adm.post(f'/api/admin/submissao/{s.id}/aprovar')
    pid = db.session.get(Submission, s.id).projeto_id
    aprovar(db.session.get(Project, pid), 'membro')
    assert adm.post(f'/api/admin/submissao/{s.id}/reavaliar').status_code == 409
    assert db.session.get(Project, pid) is not None


# ---------- #38: GET não altera dados
def test_get_nao_altera(cenario):
    c = logar('admin')
    assert c.get('/api/candidatura/1/reavaliar').status_code in (404, 405)
    assert c.get(f'/api/admin/projeto/{cenario.id}/excluir').status_code in (404, 405)
    assert db.session.get(Project, cenario.id) is not None


# ---------- #39 / #40: certificado e status
def test_certificado(cenario):
    assert flask_app.test_client().get(f'/projeto/{cenario.id}/certificado').status_code == 401
    membro = logar('membro')
    assert membro.get(f'/api/projeto/{cenario.id}/certificado').status_code == 400  # ainda em execução
    assert logar('fora').get(f'/api/projeto/{cenario.id}/certificado').status_code == 403
    cenario.status = 'CONCLUÍDO'
    db.session.commit()
    r = membro.get(f'/api/projeto/{cenario.id}/certificado')
    assert r.status_code == 200 and r.mimetype == 'application/pdf'


def test_status_invalido_e_alias(cenario):
    c = logar('admin')
    assert c.post(f'/api/admin/projeto/{cenario.id}/editar', json={'status': 'QUALQUER'}).status_code == 400
    r = c.post(f'/api/admin/projeto/{cenario.id}/editar', json={'status': 'EXECUTADO'})
    assert r.get_json()['projeto']['status'] == 'CONCLUÍDO'


# ---------- #41: avaliações
def test_avaliacao(cenario):
    url = f'/api/projeto/{cenario.id}/avaliar'
    assert logar('fora').post(url, json={'nota': 5}).status_code == 403
    m = logar('membro')
    assert m.post(url, json={'nota': 5, 'nota_organizacao': 999}).status_code == 400
    assert m.post(url, json={'nota': 5, 'comentario': 'x' * 2000}).status_code == 400
    assert m.post(url, json={'nota': 4, 'nota_organizacao': 3}).status_code == 200


# ---------- #42: exportações
def test_exportacao(cenario):
    assert logar('fora').get('/api/admin/exportar/projetos').status_code == 403
    assert logar('coord').get('/api/admin/exportar/projetos').status_code == 200
    assert logar('coord').get('/api/admin/exportar/usuarios').status_code == 403
    cenario.titulo = '=1+1'
    db.session.commit()
    corpo = logar('admin').get('/api/admin/exportar/projetos').get_data(as_text=True)
    assert "'=1+1" in corpo


# ---------- #43: administração de usuários
def test_admin_usuarios(cenario):
    adm = logar('admin')
    uid = User.query.filter_by(username='fora').first().id
    assert adm.put(f'/api/admin/usuario/{uid}', json={'role': 'hacker'}).status_code == 400
    assert adm.put(f'/api/admin/usuario/{uid}', json={'password': '12'}).status_code == 400
    assert adm.put(f'/api/admin/usuario/{uid}', json={'username': 'a@b'}).status_code == 400
    db.session.add(Application(projeto_id=cenario.id, username='fora', motivo='m', experiencia='e'))
    db.session.commit()
    assert adm.put(f'/api/admin/usuario/{uid}', json={'username': 'renomeado'}).status_code == 200
    assert Application.query.filter_by(username='renomeado').count() == 1
    dono_id = User.query.filter_by(username='dono').first().id
    assert adm.delete(f'/api/admin/usuario/{dono_id}').status_code == 409
    tk = Task(projeto_id=cenario.id, titulo='t', status='todo')
    db.session.add(tk)
    db.session.commit()
    assert adm.post(f'/api/admin/projeto/{cenario.id}/excluir').status_code == 200
    assert Task.query.count() == 0


# ---------- #44: confirmação de e-mail
def test_professor_precisa_confirmar_email(app_ctx):
    c = flask_app.test_client()
    r = c.post('/api/cadastro', json={'username': 'novo.prof', 'email': 'p@x.com', 'password': SENHA,
                                      'confirm': SENHA, 'role': 'professor'})
    assert r.status_code == 200
    from models import AccountVerification
    token = AccountVerification.query.filter_by(username='novo.prof').first().token
    adm = criar_usuario('adm2', 'admin')
    uid = User.query.filter_by(username='novo.prof').first().id
    logar('adm2').post(f'/api/admin/aprovacoes/{uid}/aprovar')
    # aprovado, mas sem e-mail confirmado: continua inativo
    assert c.post('/api/login', json={'user': 'novo.prof', 'password': SENHA}).status_code == 403
    assert c.post(f'/api/verificar-conta/{token}').status_code == 200
    assert c.post('/api/login', json={'user': 'novo.prof', 'password': SENHA}).status_code == 200


# ---------- #45: limite de tentativas
def test_login_limitado(app_ctx):
    criar_usuario('alvo')
    c = flask_app.test_client()
    codigos = [c.post('/api/login', json={'user': 'alvo', 'password': 'errada'}).status_code for _ in range(7)]
    assert codigos[:5] == [401] * 5 and codigos[-1] == 429


# ---------- #47 / #53
def test_metrics_404_e_cadastro_vazio(cenario):
    assert logar('admin').get('/api/projeto/999/metrics').status_code == 404
    c = flask_app.test_client()
    assert c.post('/api/cadastro', json={'email': None, 'username': None}).status_code == 400


def test_politica_de_senha_e_sessoes(cenario):
    a = logar('fora')
    b = logar('fora')
    r = a.post('/api/perfil/editar', json={'nova_senha': '123', 'confirmar_senha': '123'})
    assert r.status_code == 400
    r = a.post('/api/perfil/editar', json={'nova_senha': 'NovaSenha99', 'confirmar_senha': 'NovaSenha99'})
    assert r.status_code == 200
    assert a.get('/api/me').status_code == 200  # a sessão que trocou a senha continua
    assert b.get('/api/me').status_code == 401  # as demais são encerradas


# ---------- #47: formato único de erro
def test_formato_de_erro_padronizado(cenario):
    r = logar('fora').post(f'/api/projeto/{cenario.id}/tasks/criar', json={'titulo': 'x'})
    assert r.status_code == 403
    corpo = r.get_json()
    assert corpo['status'] == 'error' and corpo['message'] and 'error' not in corpo


# ---------- #54: listas paginadas no servidor
def test_listas_paginadas(app_ctx):
    criar_usuario('admin', 'admin')
    criar_usuario('coord', 'coordenador')
    for i in range(25):
        criar_projeto(owner=f'dono{i}')
    adm = logar('admin')
    r = adm.get('/api/admin/lista/projetos?per_page=10&page=3').get_json()
    assert len(r['items']) == 5 and r['total'] == 25 and r['pages'] == 3 and r['page'] == 3
    assert adm.get('/api/admin/lista/projetos?per_page=500').get_json()['per_page'] == 100
    assert adm.get('/api/admin/lista/usuarios?q=coord').get_json()['total'] == 1
    assert adm.get('/api/admin/lista/projetos?status=CONCLUÍDO').get_json()['total'] == 0
    c = logar('coord')
    assert c.get('/api/admin/lista/projetos').status_code == 200
    assert c.get('/api/admin/lista/usuarios').status_code == 403
    assert flask_app.test_client().get('/api/admin/lista/projetos').status_code == 403
    d = adm.get('/api/admin/dashboard').get_json()['data']
    assert d['totais']['projetos'] == 25


# ---------- #52: vínculos por id
def test_vinculos_por_id_sobrevivem_a_renomear(cenario):
    membro = logar('membro')
    uid = User.query.filter_by(username='membro').first().id
    assert Application.query.filter_by(username='membro').first().user_id == uid
    assert Project.query.get(cenario.id).owner_id == User.query.filter_by(username='dono').first().id
    adm = logar('admin')
    assert adm.put(f'/api/admin/usuario/{uid}', json={'username': 'membro.novo'}).status_code == 200
    # a sessão do usuário renomeado continua válida e o acesso ao projeto se mantém
    assert membro.get('/api/me').get_json()['user']['username'] == 'membro.novo'
    assert membro.get(f'/api/projeto/{cenario.id}/tasks').status_code == 200
    # mesmo que o texto do nome fique desatualizado, o vínculo por id mantém o acesso
    Application.query.filter_by(user_id=uid).update({'username': 'nome-antigo'})
    db.session.commit()
    assert membro.post(f'/api/projeto/{cenario.id}/tasks/criar', json={'titulo': 'ok'}).status_code == 200


def test_orientador_vem_do_professor_id(cenario):
    adm = logar('admin')
    pid = User.query.filter_by(username='prof').first().id
    cenario.professor = 'nome-desatualizado'
    db.session.commit()
    assert adm.get(f'/api/projeto/{cenario.id}').get_json()['projeto']['professor'] == 'prof'
    assert pid == cenario.professor_id


def test_migracao_preenche_ids(app_ctx):
    from sqlalchemy import text
    import app as app_mod
    criar_usuario('ana')
    # simula linhas antigas, sem id
    db.session.execute(text("INSERT INTO notification (username, mensagem, lida) VALUES ('ana', 'oi', 0)"))
    db.session.commit()
    assert db.session.execute(text("SELECT user_id FROM notification")).scalar() is None
    app_mod.run_db_migrations(force=True)
    db.session.rollback()  # descarta o snapshot da transação anterior
    assert db.session.execute(text("SELECT user_id FROM notification")).scalar() == User.query.filter_by(username='ana').first().id


# ---------- Login: matrícula (username) ou e-mail cadastrado
def test_login_por_matricula_ou_email(app_ctx):
    criar_usuario('2024001', 'aluno')
    c = flask_app.test_client()
    assert c.post('/api/login', json={'user': '2024001', 'password': SENHA}).status_code == 200
    assert c.post('/api/login', json={'user': '2024001@CEUB.br', 'password': SENHA}).status_code == 200
    assert c.post('/api/login', json={'user': 'outro@ceub.br', 'password': SENHA}).status_code == 401
    assert c.post('/api/login', json={'user': '2024001', 'password': 'errada1'}).status_code == 401


# ---------- Senha igual à anterior bloqueada e #60/#61/#62/#65
def test_bloqueia_mesma_senha_e_renomeia_perfil(app_ctx):
    from datetime import datetime, timedelta
    from models import PasswordReset
    criar_usuario('aluno1', 'aluno')
    c = logar('aluno1')
    # não pode alterar para a mesma senha no perfil
    r = c.post('/api/perfil/editar', json={'nova_senha': SENHA, 'confirmar_senha': SENHA})
    assert r.status_code == 400 and 'anterior' in r.get_json()['message']
    # pode alterar o próprio username (#60)
    r2 = c.post('/api/perfil/editar', json={'username': 'aluno.renomeado'})
    assert r2.status_code == 200 and r2.get_json()['user']['username'] == 'aluno.renomeado'
    # não pode redefinir via token para a mesma senha
    db.session.add(PasswordReset(username='aluno.renomeado', token='tok-same', expira_em=datetime.utcnow() + timedelta(hours=1)))
    db.session.commit()
    r3 = flask_app.test_client().post('/api/redefinir-senha/tok-same', json={'password': SENHA, 'confirm': SENHA})
    assert r3.status_code == 400 and 'anterior' in r3.get_json()['message']
