from flask import render_template, request, redirect, url_for, flash, session, abort, jsonify, Response
from werkzeug.utils import secure_filename
from datetime import datetime
import json, os, uuid, io, csv

from app_instance import app
from models import db, Project, Submission, Application, User, Notification, ActivityLog, get_random_default_cover, Message, Rating
from utils import log_atividade, upload_file_to_supabase

# =========================
# Área administrativa
# =========================
@app.route('/admin')
def admin_dashboard():
    if session.get('role') != 'admin':
        flash("Acesso restrito. Faça login como administrador.", "error")
        return redirect(url_for('login'))

    projetos_db = Project.query.all()
    projetos = [p.to_dict() for p in projetos_db]
    
    submissoes = Submission.query.all()
    candidaturas = Application.query.all()
    usuarios = User.query.all()

    return render_template('admin_dashboard.html', projetos=projetos, submissoes=submissoes, candidaturas=candidaturas, usuarios=usuarios)

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
@app.route('/api/notificacoes')
def api_notificacoes():
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
    
    username = session['user']
    notifs = Notification.query.filter_by(username=username, lida=False).order_by(Notification.data_criacao.desc()).all()
    
    output = []
    for n in notifs:
        output.append({
            "id": n.id,
            "mensagem": n.mensagem,
            "data": n.data_criacao.strftime('%d/%m %H:%M'),
            "link": n.link
        })
    return jsonify(output)

@app.route('/api/notificacoes/ler/<int:notif_id>', methods=['POST'])
def api_ler_notificacao(notif_id):
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
        
    n = Notification.query.get(notif_id)
    if n and n.username == session['user']:
        n.lida = True
        db.session.commit()
        return jsonify({"status": "success"})
        
    return jsonify({"error": "Notification not found"}), 444

@app.route('/api/notificacoes/ler-todas', methods=['POST'])
def api_ler_todas_notificacoes():
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
        
    username = session['user']
    Notification.query.filter_by(username=username, lida=False).update({Notification.lida: True})
    db.session.commit()
    return jsonify({"status": "success"})

# =========================
# CRUD Usuários (Admin)
# =========================
@app.route('/admin/usuario/novo', methods=['GET', 'POST'])
def admin_novo_usuario():
    if session.get('role') != 'admin':
        flash("Acesso restrito a administradores.", "error")
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        role = request.form.get('role', 'user')
        
        if User.query.filter_by(username=username).first():
            flash("⚠️ Este nome de usuário já existe.", "error")
            return redirect(url_for('admin_novo_usuario'))
            
        from werkzeug.security import generate_password_hash
        hashed_pw = generate_password_hash(password)
        novo_u = User(username=username, password=hashed_pw, role=role)
        db.session.add(novo_u)
        db.session.commit()
        flash("✅ Usuário criado com sucesso!", "success")
        return redirect(url_for('admin_dashboard'))
        
    return render_template('admin_user_form.html', usuario=None)

@app.route('/admin/usuario/editar/<int:user_id>', methods=['GET', 'POST'])
def admin_editar_usuario(user_id):
    if session.get('role') != 'admin':
        flash("Acesso restrito a administradores.", "error")
        return redirect(url_for('index'))
        
    u = User.query.get(user_id)
    if not u:
        abort(404)
        
    if request.method == 'POST':
        new_username = request.form.get('username')
        if new_username != u.username and User.query.filter_by(username=new_username).first():
            flash("⚠️ Este nome de usuário já existe.", "error")
            return redirect(url_for('admin_editar_usuario', user_id=user_id))
            
        u.username = new_username
        
        plain_pw = request.form.get('password')
        if plain_pw:
            from werkzeug.security import generate_password_hash
            u.password = generate_password_hash(plain_pw)
            
        if u.username != session.get('user'):
            u.role = request.form.get('role', 'user')
        
        db.session.commit()
        flash("✅ Usuário atualizado com sucesso!", "success")
        return redirect(url_for('admin_dashboard'))
        
    return render_template('admin_user_form.html', usuario=u)

@app.route('/admin/usuario/excluir/<int:user_id>')
def admin_excluir_usuario(user_id):
    if session.get('role') != 'admin':
        flash("Acesso restrito a administradores.", "error")
        return redirect(url_for('index'))
        
    u = User.query.get(user_id)
    if u:
        if u.username == session.get('user'):
            flash("⚠️ Você não pode excluir a si mesmo!", "error")
        else:
            db.session.delete(u)
            db.session.commit()
            flash("🗑️ Usuário excluído com sucesso!", "success")
            
    return redirect(url_for('admin_dashboard'))

# =========================
# Aprovação de Submissões
# =========================
@app.route('/admin/submissao/<int:sub_id>/<acao>', methods=['GET', 'POST'])
def acao_submissao(sub_id, acao):
    if session.get('role') not in ['admin', 'coordenador']:
        return redirect(url_for('index'))
    
    subm = Submission.query.get(sub_id)
    if subm:
        if acao == 'aprovar':
            subm.status = 'APROVADA'
            
            # Buscar professor orientador se especificado
            prof_id = request.args.get('professor_id') or request.form.get('professor_id')
            prof_name = subm.proponente
            prof_user = None
            if prof_id:
                prof_user = User.query.get(prof_id)
                if prof_user:
                    prof_name = prof_user.username
                    
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
                owner_username=subm.username 
            )
            db.session.add(novo_proj)
            
            # Notificar o proponente
            if subm.username:
                notif = Notification(
                    username=subm.username,
                    mensagem=f"✅ Sua proposta de projeto '{subm.nome_projeto}' foi aprovada e criada com sucesso!",
                    link="/perfil"
                )
                db.session.add(notif)
                
            if request.args.get('ajax') != '1':
                flash(f"✅ Submissão de {subm.proponente} aprovada e transformada em projeto!", "success")
            
        elif acao == 'rejeitar':
            subm.status = 'REJEITADA'
            
            # Notificar o proponente
            if subm.username:
                notif = Notification(
                    username=subm.username,
                    mensagem=f"❌ Sua proposta de projeto '{subm.nome_projeto}' foi recusada pela administração.",
                    link="/perfil"
                )
                db.session.add(notif)
                
            if request.args.get('ajax') != '1':
                flash(f"Submissão marcada como rejeitada.", "info")
            
        elif acao == 'reavaliar':
            if subm.status == 'APROVADA':
                proj = Project.query.filter_by(titulo=subm.nome_projeto, owner_username=subm.username).first()
                if proj:
                    for msg in list(proj.mensagens):
                        db.session.delete(msg)
                    for app_row in list(proj.candidaturas):
                        db.session.delete(app_row)
                    for rating in list(proj.avaliacoes):
                        db.session.delete(rating)
                    db.session.delete(proj)
            subm.status = 'EM ANÁLISE'
            if request.args.get('ajax') != '1':
                flash(f"Proposta de {subm.proponente} voltou para Em Análise.", "info")
            
        db.session.commit()
        if request.args.get('ajax') == '1':
            return jsonify({"status": "success", "new_status": subm.status})
        
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/candidatura/<int:cand_id>/<acao>')
def acao_candidatura(cand_id, acao):
    return redirect(url_for('dono_acao_candidatura', cand_id=cand_id, acao=acao, ajax=request.args.get('ajax')))

# =========================
# Criação/Edição de Projetos (Admin)
# =========================
@app.route('/admin/novo', methods=['GET', 'POST'])
def novo_projeto():
    if session.get('role') != 'admin':
        flash("Acesso restrito a administradores.", "error")
        return redirect(url_for('index'))

    if request.method == 'POST':
        imagem_path = get_random_default_cover()
        if 'imagem_capa' in request.files:
            file = request.files['imagem_capa']
            if file and file.filename != '':
                imagem_path = upload_file_to_supabase(file)

        detalhes_linhas = [linha.strip() for linha in request.form.get('detalhes', '').split('\n') if linha.strip()]
        link_nomes = request.form.getlist('link_nome[]')
        link_urls = request.form.getlist('link_url[]')
        links_dict = {}
        for nome, url in zip(link_nomes, link_urls):
            if nome.strip() and url.strip():
                links_dict[nome.strip()] = url.strip()

        novo = Project(
            titulo=request.form['titulo'],
            categoria=request.form['categoria'],
            status=request.form['status'],
            professor=request.form['professor'],
            descricao_curta=request.form['descricao_curta'],
            detalhes=json.dumps(detalhes_linhas),
            imagem=imagem_path,
            links=json.dumps(links_dict),
            owner_username=session['user'] 
        )
        db.session.add(novo)
        db.session.commit()
        
        flash("✅ Projeto criado com sucesso!", "success")
        return redirect(url_for('admin_dashboard'))

    return render_template('admin_form.html', projeto={})

@app.route('/projeto/<int:projeto_id>/editar', methods=['GET', 'POST'])
def editar_projeto(projeto_id):
    if not session.get('logged_in'):
        flash("⚠️ Você precisa estar logado.", "error")
        return redirect(url_for('login'))

    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        abort(404)

    is_owner = (projeto_db.owner_username == session['user'])
    is_admin = (session.get('role') == 'admin')

    if not is_owner and not is_admin:
        flash("⚠️ Acesso negado. Você não é dono deste projeto nem administrador.", "error")
        return redirect(url_for('perfil'))

    if request.method == 'POST':
        projeto_db.titulo = request.form['titulo']
        projeto_db.categoria = request.form['categoria']
        projeto_db.status = request.form['status']
        projeto_db.professor = request.form['professor']
        projeto_db.descricao_curta = request.form['descricao_curta']
        
        detalhes_linhas = [linha.strip() for linha in request.form.get('detalhes', '').split('\n') if linha.strip()]
        projeto_db.detalhes = json.dumps(detalhes_linhas)
        
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

        flash("✅ Projeto atualizado com sucesso!", "success")
        if is_admin:
            return redirect(url_for('admin_dashboard'))
        return redirect(url_for('perfil'))

    return render_template('admin_form.html', projeto=projeto_db.to_dict())

@app.route('/admin/excluir/<int:projeto_id>')
def excluir_projeto(projeto_id):
    if session.get('role') != 'admin':
        flash("Acesso restrito a administradores.", "error")
        return redirect(url_for('index'))

    projeto_db = Project.query.get(projeto_id)
    if projeto_db:
        for msg in list(projeto_db.mensagens):
            db.session.delete(msg)
        for app_row in list(projeto_db.candidaturas):
            db.session.delete(app_row)
        for rating in list(projeto_db.avaliacoes):
            db.session.delete(rating)
        db.session.delete(projeto_db)
        db.session.commit()

    flash("🗑️ Projeto excluído com sucesso!", "success")
    return redirect(url_for('admin_dashboard'))

# =========================
# Exportar CSV (Admin)
# =========================
@app.route('/admin/exportar/<tipo>')
def exportar_csv(tipo):
    if not session.get('logged_in') or session.get('role') != 'admin':
        abort(403)

    output = io.StringIO()
    writer = csv.writer(output)

    if tipo == 'candidaturas':
        writer.writerow(['ID', 'Projeto', 'Usuário', 'Motivo', 'Experiência', 'Status'])
        for c in Application.query.all():
            writer.writerow([c.id, c.projeto.titulo, c.username, c.motivo, c.experiencia, c.status])
        filename = 'candidaturas.csv'

    elif tipo == 'propostas':
        writer.writerow(['ID', 'Projeto', 'Categoria', 'Proponente', 'E-mail', 'Status'])
        for s in Submission.query.all():
            writer.writerow([s.id, s.nome_projeto, s.categoria, s.proponente, s.email, s.status])
        filename = 'propostas.csv'

    elif tipo == 'usuarios':
        writer.writerow(['ID', 'Username', 'Papel', 'E-mail', 'Bio'])
        for u in User.query.all():
            writer.writerow([u.id, u.username, u.role, u.email or '', u.bio or ''])
        filename = 'usuarios.csv'

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
@app.route('/admin/logs')
def admin_logs():
    if not session.get('logged_in') or session.get('role') != 'admin':
        abort(403)
    page = request.args.get('page', 1, type=int)
    filtro_user = request.args.get('user', '').strip()
    query = ActivityLog.query.order_by(ActivityLog.data.desc())
    if filtro_user:
        query = query.filter(ActivityLog.username.ilike(f'%{filtro_user}%'))
    logs_pag = query.paginate(page=page, per_page=30, error_out=False)
    return render_template('admin_logs.html', logs=logs_pag, filtro_user=filtro_user)

# =========================
# Painel do Coordenador
# =========================
@app.route('/coordenador')
def coordenador_dashboard():
    if session.get('role') not in ['admin', 'coordenador']:
        flash("Acesso restrito. Faça login como coordenador ou admin.", "error")
        return redirect(url_for('login'))
        
    submissoes = Submission.query.all()
    projetos = Project.query.all()
    professores = User.query.filter_by(role='professor').all()
    
    return render_template('coordenador_dashboard.html', submissoes=submissoes, projetos=projetos, professores=professores)

@app.route('/coordenador/projeto/<int:proj_id>/atribuir', methods=['POST'])
def coordenador_atribuir_professor(proj_id):
    if session.get('role') not in ['admin', 'coordenador']:
        return jsonify({"error": "Acesso negado"}), 403
        
    proj = Project.query.get(proj_id)
    if not proj:
        return jsonify({"error": "Projeto não encontrado"}), 404
        
    prof_id = request.form.get('professor_id') or request.args.get('professor_id')
    if prof_id:
        prof = User.query.get(prof_id)
        if prof and prof.role == 'professor':
            proj.professor_id = prof.id
            proj.professor = prof.username
            db.session.commit()
            log_atividade(session['user'], f'Atribuiu professor {prof.username} ao projeto #{proj.id}')
            return jsonify({"status": "success", "professor": prof.username})
            
    return jsonify({"error": "Professor inválido ou não informado"}), 400

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

