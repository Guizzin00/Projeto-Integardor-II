from flask import request, redirect, url_for, flash, session, abort, jsonify, Response
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import json, os, uuid, io, csv

from app_instance import app
from models import db, Project, Submission, Application, User, Notification, ActivityLog, get_random_default_cover, Message, Rating, Task, PasswordReset, AccountVerification
from utils import PAPEIS_VALIDOS, STATUS_PROJETO, normalizar_status_projeto, proteger_celula_csv, validar_senha, log_atividade, upload_file_to_supabase, enviar_email, email_template_conta_aprovada, email_template_conta_recusada, get_frontend_url

# =========================
# Área administrativa API
# =========================
@app.route('/api/admin/dashboard', methods=['GET'])
def api_admin_dashboard():
    if session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Acesso restrito."}), 403

    projetos_db = Project.query.all()
    projetos = [p.to_dict() for p in projetos_db]
    
    submissoes = [s.to_dict() for s in Submission.query.all()]
    candidaturas = [c.to_dict() for c in Application.query.all()]
    usuarios = [{"id": u.id, "username": u.username, "role": u.role, "email": u.email, "ativo": u.ativo, "status_aprovacao": getattr(u, 'status_aprovacao', 'APROVADO')} for u in User.query.all()]
    aprovacoes_pendentes_count = User.query.filter(User.status_aprovacao == 'PENDENTE').count()

    return jsonify({
        "status": "success",
        "data": {
            "projetos": projetos,
            "submissoes": submissoes,
            "candidaturas": candidaturas,
            "usuarios": usuarios,
            "aprovacoes_pendentes_count": aprovacoes_pendentes_count
        }
    })

@app.route('/api/admin/stats')
def api_admin_stats():
    if session.get('role') != 'admin':
        return jsonify({"error": "Unauthorized"}), 401
        
    projects = Project.query.all()
    status_counts = {}
    category_counts = {}
    
    for p in projects:
        status_counts[p.status] = status_counts.get(p.status, 0) + 1
        category_counts[p.categoria] = category_counts.get(p.categoria, 0) + 1
        
    return jsonify({
        "status": status_counts,
        "categoria": category_counts
    })

# =========================
# API de Notificações
# =========================
@app.route('/api/notificacoes', methods=['GET'])
def api_notificacoes():
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
    
    username = session['user']
    notifs = Notification.query.filter_by(username=username, lida=False).order_by(Notification.data_criacao.desc()).all()
    
    BRT = timedelta(hours=-3)  # Horário de Brasília = UTC-3
    output = []
    for n in notifs:
        data_val = n.data_criacao
        if data_val:
            # Remove timezone info do Postgres (TIMESTAMPTZ) para trabalhar como UTC naive
            if hasattr(data_val, 'tzinfo') and data_val.tzinfo is not None:
                data_val = data_val.replace(tzinfo=None)
            # Converte de UTC para horário de Brasília (UTC-3)
            data_val = data_val + BRT
        data_str = data_val.strftime('%d/%m %H:%M') if data_val else ''
        output.append({
            "id": n.id,
            "mensagem": n.mensagem,
            "data": data_str,
            "link": n.link
        })
    return jsonify({"status": "success", "data": output})

@app.route('/api/notificacoes/ler/<int:notif_id>', methods=['POST'])
def api_ler_notificacao(notif_id):
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
    
    # Bug 2: HTTP 444 → 404  |  Bug 3: query.get() depreciado → db.session.get()
    n = db.session.get(Notification, notif_id)
    if n and n.username == session['user']:
        n.lida = True
        db.session.commit()
        return jsonify({"status": "success"})
        
    return jsonify({"error": "Notification not found"}), 404

@app.route('/api/notificacoes/ler-todas', methods=['POST'])
def api_ler_todas_notificacoes():
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
        
    username = session['user']
    # Bug 4: chave deve ser string, não atributo do modelo
    Notification.query.filter_by(username=username, lida=False).update({"lida": True})
    db.session.commit()
    return jsonify({"status": "success"})

# =========================
# CRUD Usuários (Admin API)
# =========================
# =========================
# CRUD Usuários (Admin API)
# =========================
@app.route('/api/admin/usuario', methods=['POST'])
@app.route('/api/admin/usuario/novo', methods=['POST'])
def api_admin_novo_usuario():
    if session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Acesso restrito."}), 403
    
    data = request.get_json(silent=True) or request.form
    username = str(data.get('username') or '').strip()
    password = data.get('password')
    role = str(data.get('role') or 'aluno').strip().lower()

    if not username or not password:
        return jsonify({"status": "error", "message": "Username e senha são obrigatórios."}), 400

    if '@' in username or len(username) > 50:
        return jsonify({"status": "error", "message": "O usuário/matrícula não pode conter '@' nem passar de 50 caracteres."}), 400

    if role not in PAPEIS_VALIDOS:
        return jsonify({"status": "error", "message": "Papel inválido."}), 400

    erro_senha = validar_senha(password)
    if erro_senha:
        return jsonify({"status": "error", "message": erro_senha}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"status": "error", "message": "Usuário já existe."}), 400
        
    from werkzeug.security import generate_password_hash
    hashed_pw = generate_password_hash(password)
    novo_u = User(username=username, email=(data.get('email') or f"{username.lower()}@ceub.br"), password=hashed_pw, role=role, ativo=True)
    db.session.add(novo_u)
    db.session.commit()
    return jsonify({"status": "success", "message": "Usuário criado com sucesso.", "user": {"id": novo_u.id, "username": novo_u.username, "role": novo_u.role}})

@app.route('/api/admin/usuario/<int:user_id>', methods=['GET', 'PUT', 'DELETE'])
@app.route('/api/admin/usuario/<int:user_id>/editar', methods=['POST', 'PUT'])
def api_admin_usuario(user_id):
    if session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Acesso restrito."}), 403
        
    u = User.query.get(user_id)
    if not u:
        return jsonify({"status": "error", "message": "Usuário não encontrado."}), 404
        
    if request.method == 'GET':
        return jsonify({
            "status": "success",
            "user": {
                "id": u.id,
                "username": u.username,
                "role": u.role,
                "email": u.email,
                "bio": u.bio,
                "interesses": u.interesses,
                "ativo": u.ativo
            }
        })
        
    if request.method == 'DELETE':
        if u.username == session.get('user'):
            return jsonify({"status": "error", "message": "Não pode excluir a si mesmo."}), 400
        vinculos = []
        if Project.query.filter_by(owner_username=u.username).count():
            vinculos.append("é dono de projetos")
        if Project.query.filter_by(professor_id=u.id).count():
            vinculos.append("é orientador de projetos")
        if Application.query.filter_by(username=u.username, status='APROVADA').count():
            vinculos.append("integra equipes de projetos")
        if vinculos:
            return jsonify({"status": "error", "message": "Não é possível excluir: o usuário " + ", ".join(vinculos) + ". Reatribua ou desative a conta."}), 409
        Notification.query.filter_by(username=u.username).delete()
        Application.query.filter_by(username=u.username).delete()
        PasswordReset.query.filter_by(username=u.username).delete()
        AccountVerification.query.filter_by(username=u.username).delete()
        db.session.delete(u)
        db.session.commit()
        return jsonify({"status": "success", "message": "Usuário excluído com sucesso."})

    if request.method in ['PUT', 'POST']:
        data = request.get_json(silent=True) or request.form
        new_username = str(data.get('username') or '').strip()
        if new_username and new_username != u.username:
            if '@' in new_username or len(new_username) > 50:
                return jsonify({"status": "error", "message": "O usuário/matrícula não pode conter '@' nem passar de 50 caracteres."}), 400
            if User.query.filter_by(username=new_username).first():
                return jsonify({"status": "error", "message": "Nome de usuário já existe."}), 400

        plain_pw = data.get('password')
        if plain_pw:
            erro_senha = validar_senha(plain_pw)
            if erro_senha:
                return jsonify({"status": "error", "message": erro_senha}), 400

        novo_papel = None
        if 'role' in data and u.username != session.get('user'):
            novo_papel = str(data.get('role') or '').strip().lower()
            if novo_papel not in PAPEIS_VALIDOS:
                return jsonify({"status": "error", "message": "Papel inválido."}), 400

        if new_username and new_username != u.username:
            renomear_usuario(u.username, new_username)
            u.username = new_username
        if plain_pw:
            from werkzeug.security import generate_password_hash
            u.password = generate_password_hash(plain_pw)
        if novo_papel:
            u.role = novo_papel

        db.session.commit()
        return jsonify({"status": "success", "message": "Usuário atualizado com sucesso.", "user": {"id": u.id, "username": u.username, "role": u.role}})


def renomear_usuario(antigo, novo):
    """Propaga a mudança de username para todas as tabelas que guardam o nome como texto."""
    from models import Task as _Task
    for modelo, campo in [(Application, 'username'), (Project, 'owner_username'), (Project, 'professor'),
                          (Message, 'username'), (Notification, 'username'), (Rating, 'username'),
                          (Submission, 'username'), (ActivityLog, 'username'), (_Task, 'assigned_username'),
                          (PasswordReset, 'username'), (AccountVerification, 'username')]:
        modelo.query.filter(getattr(modelo, campo) == antigo).update({campo: novo}, synchronize_session=False)

# =========================
# Aprovação de Submissões
# =========================
@app.route('/api/admin/submissao/<int:sub_id>/<acao>', methods=['POST'])
@app.route('/admin/submissao/<int:sub_id>/<acao>', methods=['POST'])
def acao_submissao(sub_id, acao):
    if session.get('role') not in ['admin', 'coordenador']:
        return jsonify({"status": "error", "message": "Acesso não autorizado."}), 403
    
    subm = Submission.query.get(sub_id)
    if not subm:
        return jsonify({"status": "error", "message": "Submissão não encontrada."}), 404
        
    data = request.get_json(silent=True) or request.form
    if acao == 'aprovar':
        if subm.status == 'APROVADA':
            return jsonify({"status": "error", "message": "Esta proposta já foi aprovada."}), 409
        subm.status = 'APROVADA'

        prof_id = request.args.get('professor_id') or data.get('professor_id')
        prof_name = ''
        prof_user = None
        if prof_id:
            try:
                prof_user = User.query.get(int(prof_id))
                if prof_user:
                    prof_name = prof_user.username
            except (ValueError, TypeError):
                pass

        novo_proj = Project(
            titulo=subm.nome_projeto,
            status="EM EXECUÇÃO",
            professor=prof_name,
            professor_id=prof_user.id if prof_user else None,
            categoria=subm.categoria,
            descricao_curta=subm.descricao,
            imagem=subm.imagem or get_random_default_cover(),
            detalhes=json.dumps([subm.descricao]),
            links="{}",
            owner_username=subm.username,
            tags=subm.tags or ""
        )
        db.session.add(novo_proj)
        db.session.flush()
        subm.projeto_id = novo_proj.id

        if subm.username:
            notif = Notification(
                username=subm.username,
                mensagem=f"✅ Sua proposta de projeto '{subm.nome_projeto}' foi aprovada e criada com sucesso!",
                link="/perfil"
            )
            db.session.add(notif)

    elif acao == 'rejeitar':
        subm.status = 'REJEITADA'
        if subm.username:
            notif = Notification(
                username=subm.username,
                mensagem=f"❌ Sua proposta de projeto '{subm.nome_projeto}' foi recusada pela administração.",
                link="/perfil"
            )
            db.session.add(notif)

    elif acao == 'reavaliar':
        if subm.status == 'APROVADA':
            proj = db.session.get(Project, subm.projeto_id) if subm.projeto_id else \
                Project.query.filter_by(titulo=subm.nome_projeto, owner_username=subm.username).first()
            if proj:
                tem_dados = (Application.query.filter_by(projeto_id=proj.id).count()
                             or Message.query.filter_by(projeto_id=proj.id).count()
                             or Rating.query.filter_by(projeto_id=proj.id).count()
                             or Task.query.filter_by(projeto_id=proj.id).count())
                if tem_dados:
                    return jsonify({"status": "error", "message": "Não é possível reavaliar: o projeto criado já possui equipe, tarefas, mensagens ou avaliações."}), 409
                db.session.delete(proj)
            subm.projeto_id = None
        subm.status = 'EM ANÁLISE'
    else:
        return jsonify({"status": "error", "message": "Ação inválida."}), 400

    db.session.commit()
    return jsonify({"status": "success", "new_status": subm.status, "message": f"Submissão marcada como {subm.status}."})

# =========================
# Criação/Edição de Projetos (Admin API)
# =========================
@app.route('/api/admin/projeto/novo', methods=['POST'])
@app.route('/admin/novo', methods=['GET', 'POST'])
def novo_projeto():
    if session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Acesso restrito a administradores."}), 403

    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        imagem_path = get_random_default_cover()
        if 'imagem_capa' in request.files:
            file = request.files['imagem_capa']
            if file and file.filename != '':
                imagem_path = upload_file_to_supabase(file)

        raw_detalhes = data.get('detalhes', '')
        if isinstance(raw_detalhes, list):
            detalhes_linhas = raw_detalhes
        else:
            detalhes_linhas = [linha.strip() for linha in str(raw_detalhes).split('\n') if linha.strip()]
            
        link_nomes = request.form.getlist('link_nome[]') if request.form else []
        link_urls = request.form.getlist('link_url[]') if request.form else []
        links_dict = {}
        for nome, url in zip(link_nomes, link_urls):
            if nome.strip() and url.strip():
                links_dict[nome.strip()] = url.strip()

        novo = Project(
            titulo=data.get('titulo'),
            categoria=data.get('categoria'),
            status=normalizar_status_projeto(data.get('status') or 'DISPONÍVEL') or 'DISPONÍVEL',
            professor=data.get('professor') or '',
            descricao_curta=data.get('descricao_curta'),
            detalhes=json.dumps(detalhes_linhas),
            imagem=imagem_path,
            links=json.dumps(links_dict),
            owner_username=session['user'],
            tags=data.get('tags', '')
        )
        db.session.add(novo)
        db.session.commit()
        
        return jsonify({"status": "success", "message": "Projeto criado com sucesso!", "projeto": novo.to_dict()})

    return jsonify({"status": "ready", "projeto": {}})

@app.route('/api/admin/projeto/<int:projeto_id>/editar', methods=['POST', 'PUT'])
@app.route('/api/projeto/<int:projeto_id>/editar', methods=['POST', 'PUT'])
@app.route('/projeto/<int:projeto_id>/editar', methods=['GET', 'POST'])
def editar_projeto(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Você precisa estar logado."}), 401

    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        return jsonify({"status": "error", "message": "Projeto não encontrado."}), 404

    usuario_atual = User.query.filter_by(username=session['user']).first()
    is_owner = (projeto_db.owner_username == session['user'])
    is_admin = (session.get('role') == 'admin')
    is_orientador = bool(
        session.get('role') == 'professor' and usuario_atual and (
            projeto_db.professor_id == usuario_atual.id or projeto_db.professor == usuario_atual.username
        )
    )

    if not (is_owner or is_admin or is_orientador):
        return jsonify({"status": "error", "message": "Acesso negado. Apenas o dono, o professor orientador ou admin pode editar."}), 403

    if request.method in ['POST', 'PUT']:
        data = request.get_json(silent=True) or request.form
        if 'titulo' in data: projeto_db.titulo = data.get('titulo')
        if 'categoria' in data: projeto_db.categoria = data.get('categoria')
        if 'status' in data:
            novo_status = normalizar_status_projeto(data.get('status'))
            if not novo_status:
                return jsonify({"status": "error", "message": "Status inválido. Use: " + ", ".join(STATUS_PROJETO) + "."}), 400
            if novo_status == 'CONCLUÍDO' and projeto_db.status != 'CONCLUÍDO':
                projeto_db.concluido_em = datetime.utcnow()
            elif novo_status != 'CONCLUÍDO':
                projeto_db.concluido_em = None
            projeto_db.status = novo_status
        if 'professor' in data and is_admin: projeto_db.professor = data.get('professor')
        if 'descricao_curta' in data: projeto_db.descricao_curta = data.get('descricao_curta')
        if 'tags' in data:
            tags_unicas = {}
            for t in str(data.get('tags') or '').split(','):
                if t.strip():
                    tags_unicas.setdefault(t.strip().lower(), t.strip())
            projeto_db.tags = ', '.join(tags_unicas.values())
        
        raw_detalhes = data.get('detalhes')
        if data.get('detalhes_json'):
            try:
                parsed = json.loads(data.get('detalhes_json'))
                if isinstance(parsed, list):
                    raw_detalhes = parsed
            except (ValueError, TypeError):
                pass
        if raw_detalhes is not None:
            if isinstance(raw_detalhes, list):
                detalhes_linhas = raw_detalhes
            else:
                detalhes_linhas = [linha.strip() for linha in str(raw_detalhes).split('\n') if linha.strip()]
            projeto_db.detalhes = json.dumps(detalhes_linhas)
        
        if request.form and 'link_nome[]' in request.form:
            link_nomes = request.form.getlist('link_nome[]')
            link_urls = request.form.getlist('link_url[]')
            links_dict = {}
            for nome, url in zip(link_nomes, link_urls):
                if nome.strip() and url.strip():
                    links_dict[nome.strip()] = url.strip()
            projeto_db.links = json.dumps(links_dict)

        if 'imagem_capa' in request.files:
            file = request.files['imagem_capa']
            if file and file.filename != '':
                projeto_db.imagem = upload_file_to_supabase(file)

        db.session.commit()
        return jsonify({"status": "success", "message": "Projeto atualizado com sucesso!", "projeto": projeto_db.to_dict()})

    return jsonify({"status": "success", "projeto": projeto_db.to_dict()})

@app.route('/api/admin/projeto/<int:projeto_id>/excluir', methods=['POST', 'DELETE'])
@app.route('/admin/excluir/<int:projeto_id>', methods=['POST', 'DELETE'])
def excluir_projeto(projeto_id):
    if session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Acesso restrito a administradores."}), 403

    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        return jsonify({"status": "error", "message": "Projeto não encontrado."}), 404

    for msg in list(projeto_db.mensagens): db.session.delete(msg)
    for app_row in list(projeto_db.candidaturas): db.session.delete(app_row)
    for rating in list(projeto_db.avaliacoes): db.session.delete(rating)
    Task.query.filter_by(projeto_id=projeto_db.id).delete()
    Submission.query.filter_by(projeto_id=projeto_db.id).update({'projeto_id': None})
    db.session.delete(projeto_db)
    db.session.commit()

    return jsonify({"status": "success", "message": "Projeto excluído com sucesso!"})

# =========================
# Exportar CSV (única rota)
# =========================
EXPORT_TIPOS_COORDENADOR = {'projetos', 'satisfacao'}


@app.route('/api/admin/exportar/<tipo>')
def exportar_csv(tipo):
    role = session.get('role')
    if not session.get('logged_in') or role not in ('admin', 'coordenador'):
        return jsonify({"status": "error", "message": "Acesso restrito."}), 403
    if role == 'coordenador' and tipo not in EXPORT_TIPOS_COORDENADOR:
        return jsonify({"status": "error", "message": "Coordenadores só podem exportar projetos e satisfação."}), 403

    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output, delimiter=';')

    def linha(*valores):
        writer.writerow([proteger_celula_csv(v) for v in valores])

    if tipo == 'candidaturas':
        linha('ID', 'Projeto', 'Usuário', 'Motivo', 'Experiência', 'Status')
        for c in Application.query.all():
            linha(c.id, c.projeto.titulo if c.projeto else "", c.username, c.motivo, c.experiencia, c.status)
        filename = 'candidaturas.csv'

    elif tipo in ('propostas', 'submissoes'):
        linha('ID', 'Projeto', 'Categoria', 'Proponente', 'E-mail', 'Status')
        for s_ in Submission.query.all():
            linha(s_.id, s_.nome_projeto, s_.categoria, s_.proponente, s_.email, s_.status)
        filename = 'propostas.csv'

    elif tipo == 'usuarios':
        linha('ID', 'Username', 'Papel', 'E-mail', 'Bio')
        for u in User.query.all():
            linha(u.id, u.username, u.role, u.email or '', u.bio or '')
        filename = 'usuarios.csv'

    elif tipo == 'projetos':
        linha('ID', 'Título', 'Status', 'Orientador', 'Categoria', 'Proponente',
              'Total Integrantes', 'Total Tarefas', 'Tarefas Concluídas')
        for p in Project.query.all():
            linha(p.id, p.titulo, p.status, p.professor, p.categoria, p.owner_username or '',
                  Application.query.filter_by(projeto_id=p.id, status='APROVADA').count(),
                  Task.query.filter_by(projeto_id=p.id).count(),
                  Task.query.filter_by(projeto_id=p.id, status='done').count())
        filename = 'projetos.csv'

    elif tipo == 'satisfacao':
        linha('ID Avaliação', 'ID Projeto', 'Título do Projeto', 'Usuário', 'Nota Geral',
              'Nota Organização', 'Nota Orientação', 'Nota Aprendizado', 'Comentário', 'Data')
        for r in Rating.query.all():
            linha(r.id, r.projeto_id, r.projeto.titulo if r.projeto else 'Desconhecido', r.username, r.nota,
                  r.nota_organizacao or 5, r.nota_orientacao or 5, r.nota_aprendizado or 5, r.comentario or '',
                  r.data_criacao.strftime('%d/%m/%Y %H:%M') if r.data_criacao else '')
        filename = 'satisfacao.csv'

    elif tipo == 'logs':
        linha('ID Log', 'Usuário', 'Ação', 'Detalhes', 'Data')
        for l in ActivityLog.query.order_by(ActivityLog.data.desc()).all():
            linha(l.id, l.username, l.acao, l.detalhes or '', l.data.strftime('%d/%m/%Y %H:%M') if l.data else '')
        filename = 'logs.csv'

    else:
        return jsonify({"status": "error", "message": "Tipo de exportação inválido."}), 404

    log_atividade(session['user'], f'Exportou CSV: {tipo}')
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )

# =========================
# Logs de Atividade (Admin)
# =========================
@app.route('/api/admin/logs')
@app.route('/admin/logs')
def admin_logs():
    if not session.get('logged_in') or session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Acesso não autorizado."}), 403
    page = request.args.get('page', 1, type=int)
    filtro_user = request.args.get('user', '').strip()
    query = ActivityLog.query.order_by(ActivityLog.data.desc())
    if filtro_user:
        query = query.filter(ActivityLog.username.ilike(f'%{filtro_user}%'))
    logs_pag = query.paginate(page=page, per_page=30, error_out=False)
    return jsonify({
        "status": "success",
        "logs": [
            {
                "id": l.id,
                "username": l.username,
                "acao": l.acao,
                "detalhes": l.detalhes,
                "data": l.data.strftime("%d/%m/%Y %H:%M") if l.data else ""
            } for l in logs_pag.items
        ],
        "total": logs_pag.total,
        "page": logs_pag.page,
        "pages": logs_pag.pages
    })

# =========================
# Painel do Coordenador (API)
# =========================
@app.route('/api/coordenador')
def coordenador_dashboard():
    if session.get('role') not in ['admin', 'coordenador']:
        return jsonify({"status": "error", "message": "Acesso restrito."}), 403
        
    submissoes = Submission.query.all()
    projetos = Project.query.all()
    professores = User.query.filter_by(role='professor').all()
    aprovacoes_pendentes_count = User.query.filter(User.status_aprovacao == 'PENDENTE').count()
    
    return jsonify({
        "status": "success",
        "submissoes": [s.to_dict() for s in submissoes],
        "projetos": [p.to_dict() for p in projetos],
        "professores": [{"id": pr.id, "username": pr.username} for pr in professores],
        "aprovacoes_pendentes_count": aprovacoes_pendentes_count
    })

# =========================
# Gestão de Aprovações de Contas (Admin & Coordenador)
# =========================
@app.route('/api/admin/aprovacoes', methods=['GET'])
def api_admin_listar_aprovacoes():
    if session.get('role') not in ['admin', 'coordenador']:
        return jsonify({"status": "error", "message": "Acesso restrito a coordenadores e administradores."}), 403

    # Busca contas que requerem validação (professor e empresa, ou qualquer conta com status pendente)
    usuarios = User.query.filter(
        db.or_(
            User.role.in_(['professor', 'empresa']),
            User.status_aprovacao == 'PENDENTE'
        )
    ).all()

    # Ordena: Pendentes primeiro, depois por id decrescente
    def sort_key(u):
        status_rank = 0 if getattr(u, 'status_aprovacao', 'APROVADO') == 'PENDENTE' else 1
        return (status_rank, -u.id)

    usuarios_ordenados = sorted(usuarios, key=sort_key)
    resultado = [u.to_dict() for u in usuarios_ordenados]
    pendentes_count = sum(1 for u in usuarios if getattr(u, 'status_aprovacao', 'APROVADO') == 'PENDENTE')

    return jsonify({
        "status": "success",
        "data": {
            "usuarios": resultado,
            "pendentes_count": pendentes_count
        }
    })

@app.route('/api/admin/aprovacoes/<int:user_id>/aprovar', methods=['POST'])
def api_admin_aprovar_usuario(user_id):
    if session.get('role') not in ['admin', 'coordenador']:
        return jsonify({"status": "error", "message": "Acesso restrito."}), 403

    usuario = db.session.get(User, user_id)
    if not usuario:
        return jsonify({"status": "error", "message": "Usuário não encontrado."}), 404

    usuario.status_aprovacao = 'APROVADO'
    usuario.ativo = bool(usuario.email_verificado)  # só libera o acesso com e-mail confirmado
    db.session.commit()

    log_atividade(session.get('user', 'sistema'), f'Aprovou cadastro institucional de {usuario.role}: @{usuario.username}')

    # Notificação interna para o usuário
    try:
        notif = Notification(
            username=usuario.username,
            mensagem=f"Parabéns! Sua conta institucional de {usuario.role.capitalize()} foi homologada com sucesso.",
            link="/perfil"
        )
        db.session.add(notif)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao criar notificação de aprovação: {e}")

    # Envia e-mail de liberação de conta
    if usuario.email:
        base_url = get_frontend_url() or request.host_url.rstrip('/')
        login_url = base_url + "/login"
        corpo = email_template_conta_aprovada(usuario.username, usuario.role, login_url=login_url)
        enviar_email(usuario.email, 'Acesso Institucional Homologado – SisCPTI · UniCEUB', corpo)

    return jsonify({
        "status": "success",
        "message": f"Conta de @{usuario.username} homologada e liberada com sucesso!",
        "usuario": usuario.to_dict()
    })

@app.route('/api/admin/aprovacoes/<int:user_id>/rejeitar', methods=['POST'])
def api_admin_rejeitar_usuario(user_id):
    if session.get('role') not in ['admin', 'coordenador']:
        return jsonify({"status": "error", "message": "Acesso restrito."}), 403

    usuario = db.session.get(User, user_id)
    if not usuario:
        return jsonify({"status": "error", "message": "Usuário não encontrado."}), 404

    data = request.get_json(silent=True) or {}
    motivo = data.get('motivo', '').strip()

    usuario.status_aprovacao = 'REJEITADO'
    usuario.ativo = False
    db.session.commit()

    log_atividade(session.get('user', 'sistema'), f'Recusou cadastro de {usuario.role}: @{usuario.username}. Motivo: {motivo or "Não especificado"}')

    # Envia e-mail informando a recusa
    if usuario.email:
        corpo = email_template_conta_recusada(usuario.username, usuario.role, motivo=motivo)
        enviar_email(usuario.email, 'Atualização sobre Cadastro Institucional – SisCPTI · UniCEUB', corpo)

    return jsonify({
        "status": "success",
        "message": f"Solicitação de @{usuario.username} foi indeferida.",
        "usuario": usuario.to_dict()
    })

@app.route('/api/coordenador/projeto/<int:proj_id>/atribuir', methods=['POST'])
@app.route('/coordenador/projeto/<int:proj_id>/atribuir', methods=['POST'])
def coordenador_atribuir_professor(proj_id):
    if session.get('role') not in ['admin', 'coordenador']:
        return jsonify({"status": "error", "message": "Acesso negado"}), 403
        
    proj = Project.query.get(proj_id)
    if not proj:
        return jsonify({"status": "error", "message": "Projeto não encontrado"}), 404
        
    data = request.get_json(silent=True) or request.form
    prof_id = data.get('professor_id') or request.args.get('professor_id')
    if prof_id:
        try:
            prof = User.query.get(int(prof_id))
            if prof and prof.role == 'professor':
                proj.professor_id = prof.id
                proj.professor = prof.username
                log_atividade(session['user'], f'Atribuiu professor {prof.username} ao projeto #{proj.id}')
                return jsonify({"status": "success", "message": f"Professor {prof.username} atribuído ao projeto!", "projeto": proj.to_dict()})
        except: pass
            
    return jsonify({"status": "error", "message": "Professor inválido ou não informado"}), 400

@app.route('/api/admin/satisfacao')
def api_admin_satisfacao():
    if session.get('role') not in ['admin', 'coordenador']:
        return jsonify({"error": "Unauthorized"}), 401
        
    ratings = Rating.query.all()
    if not ratings:
        return jsonify({
            "nota": 0,
            "nota_organizacao": 0,
            "nota_orientacao": 0,
            "nota_aprendizado": 0,
            "total": 0
        })
        
    total = len(ratings)
    avg_nota = sum(r.nota for r in ratings) / total
    avg_org = sum(r.nota_organizacao or 5 for r in ratings) / total
    avg_ori = sum(r.nota_orientacao or 5 for r in ratings) / total
    avg_apr = sum(r.nota_aprendizado or 5 for r in ratings) / total
    
    return jsonify({
        "nota": round(avg_nota, 2),
        "nota_organizacao": round(avg_org, 2),
        "nota_orientacao": round(avg_ori, 2),
        "nota_aprendizado": round(avg_apr, 2),
        "total": total
    })

@app.route('/admin/relatorio/pdf')
def admin_relatorio_pdf():
    if session.get('role') not in ['admin', 'coordenador']:
        abort(403)
        
    from admin_report import gerar_pdf_relatorio_geral
    usuarios = User.query.all()
    projetos = Project.query.all()
    submissoes = Submission.query.all()
    ratings = Rating.query.all()
    
    pdf_data = gerar_pdf_relatorio_geral(usuarios, projetos, submissoes, ratings)
    
    return Response(
        pdf_data,
        mimetype='application/pdf',
        headers={'Content-Disposition': 'attachment; filename=relatorio_geral_siscpti.pdf'}
    )
