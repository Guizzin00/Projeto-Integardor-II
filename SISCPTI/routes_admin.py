from flask import request, redirect, url_for, flash, session, abort, jsonify, Response
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import json, os, uuid, io, csv

from app_instance import app
from models import db, Project, Submission, Application, User, Notification, ActivityLog, get_random_default_cover, Message, Rating
from utils import log_atividade, upload_file_to_supabase, enviar_email, email_template_conta_aprovada, email_template_conta_recusada, get_frontend_url

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
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')
    
    if not username or not password:
        return jsonify({"status": "error", "message": "Username e senha são obrigatórios."}), 400
        
    if '@' in username:
        return jsonify({"status": "error", "message": "O usuário/matrícula não pode conter '@'."}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"status": "error", "message": "Usuário já existe."}), 400
        
    from werkzeug.security import generate_password_hash
    hashed_pw = generate_password_hash(password)
    novo_u = User(username=username, password=hashed_pw, role=role, ativo=True)
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
        db.session.delete(u)
        db.session.commit()
        return jsonify({"status": "success", "message": "Usuário excluído com sucesso."})
        
    if request.method in ['PUT', 'POST']:
        data = request.get_json(silent=True) or request.form
        new_username = data.get('username')
        if new_username and new_username != u.username and User.query.filter_by(username=new_username).first():
            return jsonify({"status": "error", "message": "Nome de usuário já existe."}), 400
            
        if new_username: u.username = new_username
        plain_pw = data.get('password')
        if plain_pw and len(plain_pw) >= 4:
            from werkzeug.security import generate_password_hash
            u.password = generate_password_hash(plain_pw)
            
        if u.username != session.get('user') and 'role' in data:
            u.role = data.get('role', u.role)
        
        db.session.commit()
        return jsonify({"status": "success", "message": "Usuário atualizado com sucesso.", "user": {"id": u.id, "username": u.username, "role": u.role}})

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
        subm.status = 'APROVADA'
        
        prof_id = request.args.get('professor_id') or data.get('professor_id')
        prof_name = subm.proponente
        prof_user = None
        if prof_id:
            try:
                prof_user = User.query.get(int(prof_id))
                if prof_user:
                    prof_name = prof_user.username
            except: pass
                
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
            proj = Project.query.filter_by(titulo=subm.nome_projeto, owner_username=subm.username).first()
            if proj:
                for msg in list(proj.mensagens): db.session.delete(msg)
                for app_row in list(proj.candidaturas): db.session.delete(app_row)
                for rating in list(proj.avaliacoes): db.session.delete(rating)
                db.session.delete(proj)
        subm.status = 'EM ANÁLISE'
        
    db.session.commit()
    return jsonify({"status": "success", "new_status": subm.status, "message": f"Submissão marcada como {subm.status}."})

@app.route('/admin/candidatura/<int:cand_id>/<acao>')
def acao_candidatura(cand_id, acao):
    return redirect(url_for('dono_acao_candidatura', cand_id=cand_id, acao=acao, ajax=1))

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
            status=data.get('status', 'DISPONÍVEL'),
            professor=data.get('professor'),
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
        if 'status' in data: projeto_db.status = data.get('status')
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
    db.session.delete(projeto_db)
    db.session.commit()

    return jsonify({"status": "success", "message": "Projeto excluído com sucesso!"})

# =========================
# Exportar CSV (Admin)
# =========================
@app.route('/api/admin/exportar/<tipo>')
@app.route('/admin/exportar/<tipo>')
def exportar_csv(tipo):
    if not session.get('logged_in') or session.get('role') != 'admin':
        abort(403)

    output = io.StringIO()
    writer = csv.writer(output)

    if tipo in ['candidaturas']:
        writer.writerow(['ID', 'Projeto', 'Usuário', 'Motivo', 'Experiência', 'Status'])
        for c in Application.query.all():
            writer.writerow([c.id, c.projeto.titulo if c.projeto else "", c.username, c.motivo, c.experiencia, c.status])
        filename = 'candidaturas.csv'

    elif tipo in ['propostas', 'submissoes']:
        writer.writerow(['ID', 'Projeto', 'Categoria', 'Proponente', 'E-mail', 'Status'])
        for s in Submission.query.all():
            writer.writerow([s.id, s.nome_projeto, s.categoria, s.proponente, s.email, s.status])
        filename = 'propostas.csv'

    elif tipo in ['usuarios']:
        writer.writerow(['ID', 'Username', 'Papel', 'E-mail', 'Bio'])
        for u in User.query.all():
            writer.writerow([u.id, u.username, u.role, u.email or '', u.bio or ''])
        filename = 'usuarios.csv'

    elif tipo in ['projetos']:
        writer.writerow(['ID', 'Título', 'Categoria', 'Status', 'Professor', 'Dono'])
        for p in Project.query.all():
            writer.writerow([p.id, p.titulo, p.categoria, p.status, p.professor, p.owner_username or ''])
        filename = 'projetos.csv'

    elif tipo in ['satisfacao']:
        writer.writerow(['ID', 'Projeto ID', 'Usuário', 'Nota Geral', 'Organização', 'Orientação', 'Aprendizado', 'Comentário'])
        for r in Rating.query.all():
            writer.writerow([r.id, r.projeto_id, r.username, r.nota, r.nota_organizacao or 5, r.nota_orientacao or 5, r.nota_aprendizado or 5, r.comentario or ''])
        filename = 'satisfacao.csv'

    elif tipo in ['logs']:
        writer.writerow(['ID', 'Usuário', 'Ação', 'Detalhes', 'Data'])
        for l in ActivityLog.query.order_by(ActivityLog.data.desc()).all():
            writer.writerow([l.id, l.username, l.acao, l.detalhes or '', l.data.strftime("%d/%m/%Y %H:%M") if l.data else ''])
        filename = 'logs.csv'

    else:
        abort(404)

    log_atividade(session['user'], f'Exportou CSV: {tipo}')
    output.seek(0)
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
    usuario.ativo = True
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

@app.route('/admin/exportar/projetos')
def admin_exportar_projetos():
    role = session.get('role')
    if role not in ['admin', 'coordenador']:
        flash("Acesso restrito.", "error")
        return redirect(url_for('login'))
        
    from models import Task
    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output, delimiter=';')
    
    writer.writerow([
        'ID', 'Título', 'Status', 'Orientador', 'Categoria', 
        'Proponente', 'Total Integrantes', 'Total Tarefas', 'Tarefas Concluídas'
    ])
    
    projetos = Project.query.all()
    for p in projetos:
        integrantes_count = Application.query.filter_by(projeto_id=p.id, status='APROVADA').count()
        total_tasks = Task.query.filter_by(projeto_id=p.id).count()
        done_tasks = Task.query.filter_by(projeto_id=p.id, status='done').count()
        
        writer.writerow([
            p.id,
            p.titulo,
            p.status,
            p.professor,
            p.categoria,
            p.owner_username or '',
            integrantes_count,
            total_tasks,
            done_tasks
        ])
        
    response = Response(output.getvalue(), mimetype='text/csv')
    response.headers['Content-Disposition'] = 'attachment; filename=relatorio_projetos.csv'
    return response

@app.route('/admin/exportar/satisfacao')
def admin_exportar_satisfacao():
    role = session.get('role')
    if role not in ['admin', 'coordenador']:
        flash("Acesso restrito.", "error")
        return redirect(url_for('login'))
        
    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output, delimiter=';')
    
    writer.writerow([
        'ID Avaliação', 'ID Projeto', 'Título do Projeto', 'Usuário', 
        'Nota Geral', 'Nota Organização', 'Nota Orientação', 'Nota Aprendizado', 
        'Comentário', 'Data'
    ])
    
    ratings = Rating.query.all()
    for r in ratings:
        proj_titulo = r.projeto.titulo if r.projeto else 'Desconhecido'
        writer.writerow([
            r.id,
            r.projeto_id,
            proj_titulo,
            r.username,
            r.nota,
            r.nota_organizacao or 5,
            r.nota_orientacao or 5,
            r.nota_aprendizado or 5,
            r.comentario or '',
            r.data_criacao.strftime('%d/%m/%Y %H:%M') if r.data_criacao else ''
        ])
        
    response = Response(output.getvalue(), mimetype='text/csv')
    response.headers['Content-Disposition'] = 'attachment; filename=relatorio_satisfacao.csv'
    return response

@app.route('/admin/exportar/logs')
def admin_exportar_logs():
    role = session.get('role')
    if role not in ['admin', 'coordenador']:
        flash("Acesso restrito.", "error")
        return redirect(url_for('login'))
        
    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output, delimiter=';')
    
    writer.writerow([
        'ID Log', 'Usuário', 'Ação', 'Detalhes', 'Data'
    ])
    
    logs = ActivityLog.query.order_by(ActivityLog.data.desc()).all()
    for l in logs:
        writer.writerow([
            l.id,
            l.username,
            l.acao,
            l.detalhes or '',
            l.data.strftime('%d/%m/%Y %H:%M') if l.data else ''
        ])
        
    response = Response(output.getvalue(), mimetype='text/csv')
    response.headers['Content-Disposition'] = 'attachment; filename=relatorio_logs.csv'
    return response

