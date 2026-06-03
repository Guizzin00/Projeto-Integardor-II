from flask import render_template, request, redirect, url_for, flash, session, abort, jsonify, send_file
from werkzeug.utils import secure_filename
from datetime import datetime
import os, uuid
from io import BytesIO

from app_instance import app
from models import db, Project, Application, Submission, Message, Notification, Rating, Task, User
from utils import log_atividade, upload_file_to_supabase

# =========================
# Catálogo e Detalhes
# =========================
@app.route('/projetos')
def projetos():
    tag_filter = request.args.get('tag', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = 6
    
    query = Project.query
    if tag_filter:
        query = query.filter(Project.tags.ilike(f'%{tag_filter}%'))
        
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Coletar todas as tags únicas dos projetos para o painel de filtros
    all_projects = Project.query.all()
    unique_tags = set()
    for p in all_projects:
        if p.tags:
            for t in p.tags.split(','):
                cleaned = t.strip()
                if cleaned:
                    unique_tags.add(cleaned)
                    
    return render_template(
        'projetos.html',
        projetos=[p.to_dict() for p in pagination.items],
        pagination=pagination,
        unique_tags=sorted(list(unique_tags)),
        selected_tag=tag_filter
    )

@app.route('/projeto/<int:projeto_id>')
def projeto_detalhes(projeto_id):
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        abort(404)
    projeto = projeto_db.to_dict()
    return render_template('projeto_detalhes.html', projeto=projeto)

# =========================
# Candidaturas de Alunos
# =========================
@app.route('/projeto/<int:projeto_id>/candidatar', methods=['GET', 'POST'])
def candidatar(projeto_id):
    if not session.get('logged_in'):
        flash("⚠️ Você precisa estar logado para se candidatar a um projeto.", "error")
        return redirect(url_for('login'))

    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        abort(404)

    if request.method == 'POST':
        nova_cand = Application(
            projeto_id=projeto_id,
            username=session['user'],
            motivo=request.form.get('motivo'),
            experiencia=request.form.get('experiencia')
        )
        db.session.add(nova_cand)
        
        # Notificar o dono do projeto
        if projeto_db.owner_username:
            notif = Notification(
                username=projeto_db.owner_username,
                mensagem=f"👤 {session['user']} se candidatou ao seu projeto '{projeto_db.titulo}'!",
                link="/perfil"
            )
            db.session.add(notif)
            
        db.session.commit()
        flash("✅ Sua candidatura foi enviada com sucesso! Aguarde o retorno do professor/dono do projeto.", "success")
        return redirect(url_for('projeto_detalhes', projeto_id=projeto_id))

    return render_template('candidatura.html', projeto=projeto_db.to_dict())

# =========================
# Perfil e Ações do Dono
# =========================
@app.route('/perfil')
def perfil():
    if not session.get('logged_in'):
        flash("Você precisa estar logado para acessar seu perfil.", "error")
        return redirect(url_for('login'))
        
    username = session['user']
    minhas_candidaturas = Application.query.filter_by(username=username).all()
    meus_projetos = Project.query.filter_by(owner_username=username).all()
    minhas_submissoes = Submission.query.filter_by(username=username).all()
    
    # Algoritmo de recomendação de projetos para o perfil do Aluno
    recomendacoes = []
    if session.get('role') in ['aluno', 'lider', 'user']:
        user_obj = User.query.filter_by(username=username).first()
        if user_obj and user_obj.interesses:
            interesses_list = [i.strip().lower() for i in user_obj.interesses.split(',') if i.strip()]
            if interesses_list:
                candidatados_ids = [c.projeto_id for c in minhas_candidaturas]
                all_projs = Project.query.filter(Project.status != 'CONCLUÍDO').all()
                
                project_scores = []
                for p in all_projs:
                    if p.id in candidatados_ids:
                        continue
                    p_tags = [t.strip().lower() for t in p.tags.split(',') if t.strip()] if p.tags else []
                    overlap = len(set(interesses_list).intersection(set(p_tags)))
                    if overlap > 0:
                        project_scores.append((p, overlap))
                
                project_scores.sort(key=lambda x: x[1], reverse=True)
                recomendacoes = [item[0].to_dict() for item in project_scores[:3]]
                
    return render_template(
        'perfil.html', 
        minhas_candidaturas=minhas_candidaturas, 
        meus_projetos=meus_projetos, 
        minhas_submissoes=minhas_submissoes,
        recomendacoes=recomendacoes
    )

@app.route('/perfil/candidatura/<int:cand_id>/<acao>')
def dono_acao_candidatura(cand_id, acao):
    if not session.get('logged_in'):
        return redirect(url_for('login'))
        
    cand = Application.query.get(cand_id)
    if not cand:
        abort(404)
        
    if cand.projeto.owner_username != session['user'] and session.get('role') != 'admin':
        flash("Acesso negado.", "error")
        return redirect(url_for('perfil'))
        
    if acao == 'aprovar':
        cand.status = 'APROVADA'
        notif = Notification(
            username=cand.username,
            mensagem=f"🎉 Sua candidatura para o projeto '{cand.projeto.titulo}' foi APROVADA!",
            link=f"/projeto/{cand.projeto_id}/workspace"
        )
        db.session.add(notif)
        if request.args.get('ajax') != '1':
            flash(f"Candidatura de {cand.username} foi aprovada!", "success")
    elif acao == 'rejeitar':
        cand.status = 'REJEITADA'
        notif = Notification(
            username=cand.username,
            mensagem=f"⚠️ Sua candidatura para o projeto '{cand.projeto.titulo}' foi recusada.",
            link="/perfil"
        )
        db.session.add(notif)
        if request.args.get('ajax') != '1':
            flash(f"Candidatura de {cand.username} foi rejeitada.", "error")
    elif acao == 'reavaliar':
        cand.status = 'PENDENTE'
        if request.args.get('ajax') != '1':
            flash(f"Candidatura de {cand.username} voltou para Pendente.", "info")
        
    db.session.commit()
    if request.args.get('ajax') == '1':
        return jsonify({"status": "success", "new_status": cand.status})
    
    if session.get('role') == 'admin' and request.referrer and 'admin' in request.referrer:
        return redirect(url_for('admin_dashboard'))
        
    return redirect(url_for('perfil'))

@app.route('/perfil/candidatura/<int:cand_id>/editar', methods=['GET', 'POST'])
def editar_candidatura(cand_id):
    if not session.get('logged_in'):
        flash("⚠️ Você precisa estar logado.", "error")
        return redirect(url_for('login'))
        
    cand = Application.query.get(cand_id)
    if not cand:
        abort(404)
        
    # Apenas o dono ou admin pode editar
    if cand.username != session['user'] and session.get('role') != 'admin':
        flash("⚠️ Acesso negado.", "error")
        return redirect(url_for('perfil'))
        
    # Apenas se estiver pendente
    if cand.status != 'PENDENTE' and session.get('role') != 'admin':
        flash("⚠️ Essa candidatura já foi avaliada e não pode mais ser editada.", "error")
        return redirect(url_for('perfil'))
        
    if request.method == 'POST':
        cand.motivo = request.form.get('motivo')
        cand.experiencia = request.form.get('experiencia')
        db.session.commit()
        flash("✅ Candidatura atualizada com sucesso!", "success")
        return redirect(url_for('perfil'))
        
    return render_template('candidatura_editar.html', candidatura=cand)

@app.route('/perfil/candidatura/<int:cand_id>/cancelar')
def cancelar_candidatura(cand_id):
    if not session.get('logged_in'):
        flash("⚠️ Você precisa estar logado.", "error")
        return redirect(url_for('login'))
        
    cand = Application.query.get(cand_id)
    if not cand:
        abort(404)
        
    # Apenas o dono ou admin pode cancelar
    if cand.username != session['user'] and session.get('role') != 'admin':
        flash("⚠️ Acesso negado.", "error")
        return redirect(url_for('perfil'))
        
    # Apenas se estiver pendente
    if cand.status != 'PENDENTE' and session.get('role') != 'admin':
        flash("⚠️ Essa candidatura já foi avaliada e não pode mais ser cancelada.", "error")
        return redirect(url_for('perfil'))
        
    db.session.delete(cand)
    db.session.commit()
    flash("🗑️ Candidatura cancelada com sucesso!", "success")
    return redirect(url_for('perfil'))

# =========================
# Workspace e Chat
# =========================
@app.route('/projeto/<int:projeto_id>/workspace')
def workspace(projeto_id):
    if not session.get('logged_in'):
        flash("Acesso negado.", "error")
        return redirect(url_for('login'))
        
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        abort(404)
        
    username = session['user']
    user_obj = User.query.filter_by(username=username).first()
    
    is_orientador = (projeto_db.professor_id == user_obj.id if user_obj and projeto_db.professor_id else False)
    is_owner = (projeto_db.owner_username == username) or is_orientador
    
    role = session.get('role')
    is_admin = (role == 'admin')
    is_coord = (role == 'coordenador')
    is_cliente_owner = (role in ['cliente', 'empresa'] and projeto_db.owner_username == username)
    
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    if not is_owner and not is_admin and not is_coord and not is_cliente_owner and username not in membros:
        flash("Acesso negado. Você não é membro aprovado deste projeto.", "error")
        return redirect(url_for('perfil'))
        
    is_po_mode = (role in ['cliente', 'coordenador', 'empresa'])
    mensagens = Message.query.filter_by(projeto_id=projeto_id).order_by(Message.data_envio.asc()).all()
    return render_template(
        'workspace.html', 
        projeto=projeto_db, 
        membros=membros, 
        mensagens=mensagens, 
        is_owner=is_owner,
        is_po_mode=is_po_mode,
        role=role
    )

@app.route('/projeto/<int:projeto_id>/workspace/enviar', methods=['POST'])
def enviar_mensagem(projeto_id):
    if not session.get('logged_in'):
        return redirect(url_for('login'))
        
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        abort(404)
        
    username = session['user']
    user_obj = User.query.filter_by(username=username).first()
    is_orientador = (projeto_db.professor_id == user_obj.id if user_obj and projeto_db.professor_id else False)
    is_owner = (projeto_db.owner_username == username) or is_orientador
    role = session.get('role')
    is_admin = (role == 'admin')
    is_coord = (role == 'coordenador')
    is_cliente_owner = (role in ['cliente', 'empresa'] and projeto_db.owner_username == username)
    
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    if not is_owner and not is_admin and not is_coord and not is_cliente_owner and username not in membros:
        abort(403)
        
    texto = request.form.get('texto')
    arquivo_path = None
    if 'arquivo' in request.files:
        file = request.files['arquivo']
        if file and file.filename != '':
            arquivo_path = upload_file_to_supabase(file)
            
    if texto or arquivo_path:
        nova_msg = Message(
            projeto_id=projeto_id,
            username=username,
            texto=texto,
            arquivo=arquivo_path
        )
        db.session.add(nova_msg)
        db.session.commit()
        
        # Parse mentions
        if texto:
            import re
            valid_users = {projeto_db.owner_username} if projeto_db.owner_username else set()
            if projeto_db.orientador:
                valid_users.add(projeto_db.orientador.username)
            for m in membros:
                valid_users.add(m)
                
            mentions = re.findall(r'@([a-zA-Z0-9_\-\.]+)', texto)
            for mention in set(mentions):
                if mention in valid_users and mention != username:
                    notif = Notification(
                        username=mention,
                        mensagem=f"Você foi mencionado por @{username} no chat do projeto '{projeto_db.titulo}'",
                        link=url_for('workspace', projeto_id=projeto_id),
                        lida=False
                    )
                    db.session.add(notif)
            db.session.commit()
        
    return redirect(url_for('workspace', projeto_id=projeto_id))

@app.route('/projeto/<int:projeto_id>/workspace/mensagens')
def workspace_mensagens_json(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
        
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        return jsonify({"error": "Project not found"}), 444
        
    username = session['user']
    is_owner = (projeto_db.owner_username == username)
    is_admin = (session.get('role') == 'admin')
    
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    if not is_owner and not is_admin and username not in membros:
        return jsonify({"error": "Forbidden"}), 403
        
    mensagens = Message.query.filter_by(projeto_id=projeto_id).order_by(Message.data_envio.asc()).all()
    output = []
    for msg in mensagens:
        output.append({
            "id": msg.id,
            "username": msg.username,
            "texto": msg.texto,
            "arquivo": msg.arquivo,
            "data_envio": msg.data_envio.strftime('%d/%m %H:%M')
        })
    return jsonify(output)

@app.route('/projeto/<int:projeto_id>/workspace/enviar_ajax', methods=['POST'])
def enviar_mensagem_ajax(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
        
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        return jsonify({"error": "Project not found"}), 444
        
    username = session['user']
    user_obj = User.query.filter_by(username=username).first()
    
    is_orientador = (projeto_db.professor_id == user_obj.id if user_obj and projeto_db.professor_id else False)
    is_owner = (projeto_db.owner_username == username) or is_orientador
    role = session.get('role')
    is_admin = (role == 'admin')
    is_coord = (role == 'coordenador')
    is_cliente_owner = (role in ['cliente', 'empresa'] and projeto_db.owner_username == username)
    
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    if not is_owner and not is_admin and not is_coord and not is_cliente_owner and username not in membros:
        return jsonify({"error": "Forbidden"}), 403
        
    texto = request.form.get('texto')
    arquivo_path = None
    if 'arquivo' in request.files:
        file = request.files['arquivo']
        if file and file.filename != '':
            arquivo_path = upload_file_to_supabase(file)
            
    if texto or arquivo_path:
        nova_msg = Message(
            projeto_id=projeto_id,
            username=session['user'],
            texto=texto,
            arquivo=arquivo_path
        )
        db.session.add(nova_msg)
        db.session.commit()
        
        # Parse mentions
        if texto:
            import re
            valid_users = {projeto_db.owner_username} if projeto_db.owner_username else set()
            if projeto_db.orientador:
                valid_users.add(projeto_db.orientador.username)
            for m in membros:
                valid_users.add(m)
                
            mentions = re.findall(r'@([a-zA-Z0-9_\-\.]+)', texto)
            for mention in set(mentions):
                if mention in valid_users and mention != username:
                    notif = Notification(
                        username=mention,
                        mensagem=f"Você foi mencionado por @{username} no chat do projeto '{projeto_db.titulo}'",
                        link=url_for('workspace', projeto_id=projeto_id),
                        lida=False
                    )
                    db.session.add(notif)
            db.session.commit()
            
        msg_dict = {
            "id": nova_msg.id,
            "username": nova_msg.username,
            "texto": nova_msg.texto,
            "arquivo": nova_msg.arquivo,
            "data_envio": nova_msg.data_envio.strftime('%d/%m %H:%M')
        }
        
        from app_instance import socketio
        socketio.emit('message', msg_dict, to=str(projeto_id))
        
        return jsonify({
            "status": "success",
            "message": msg_dict
        })
        
    return jsonify({"error": "Empty message"}), 400

# =========================
# Sistema de Avaliações
# =========================
@app.route('/projeto/<int:projeto_id>/avaliar', methods=['POST'])
def avaliar_projeto(projeto_id):
    if not session.get('logged_in'):
        return jsonify({'error': 'Não autenticado'}), 401

    proj = Project.query.get(projeto_id)
    if not proj:
        abort(404)

    nota = request.form.get('nota', type=int)
    nota_org = request.form.get('nota_organizacao', 5, type=int)
    nota_ori = request.form.get('nota_orientacao', 5, type=int)
    nota_apr = request.form.get('nota_aprendizado', 5, type=int)
    comentario = request.form.get('comentario', '').strip()

    if not nota or nota < 1 or nota > 5:
        flash("⚠️ Nota inválida. Escolha entre 1 e 5 estrelas.", "error")
        return redirect(url_for('projeto_detalhes', projeto_id=projeto_id))

    # Verifica se usuário já avaliou
    ja_avaliou = Rating.query.filter_by(projeto_id=projeto_id, username=session['user']).first()
    if ja_avaliou:
        ja_avaliou.nota = nota
        ja_avaliou.nota_organizacao = nota_org
        ja_avaliou.nota_orientacao = nota_ori
        ja_avaliou.nota_aprendizado = nota_apr
        ja_avaliou.comentario = comentario
        ja_avaliou.data_criacao = datetime.utcnow()
        flash("✅ Avaliação atualizada com sucesso!", "success")
    else:
        rating = Rating(
            projeto_id=projeto_id, 
            username=session['user'], 
            nota=nota, 
            nota_organizacao=nota_org,
            nota_orientacao=nota_ori,
            nota_aprendizado=nota_apr,
            comentario=comentario
        )
        db.session.add(rating)
        flash("✅ Avaliação enviada com sucesso!", "success")

    db.session.commit()
    log_atividade(session['user'], 'Avaliação enviada', f'Projeto #{projeto_id}, nota {nota}')
    return redirect(url_for('projeto_detalhes', projeto_id=projeto_id))

@app.route('/api/projeto/<int:projeto_id>/avaliacoes')
def api_avaliacoes(projeto_id):
    ratings = Rating.query.filter_by(projeto_id=projeto_id).order_by(Rating.data_criacao.desc()).all()
    media = round(sum(r.nota for r in ratings) / len(ratings), 1) if ratings else 0
    return jsonify({
        'media': media,
        'total': len(ratings),
        'avaliacoes': [{
            'username': r.username, 
            'nota': r.nota, 
            'nota_organizacao': r.nota_organizacao or 5,
            'nota_orientacao': r.nota_orientacao or 5,
            'nota_aprendizado': r.nota_aprendizado or 5,
            'comentario': r.comentario,
            'data': r.data_criacao.strftime('%d/%m/%Y')
        } for r in ratings]
    })

# =========================
# Submissão de projetos (restrita a logados)
# =========================
@app.route('/submissao', methods=['GET', 'POST'])
def submissao():
    if not session.get('logged_in'):
        flash("⚠️ Você precisa estar logado para acessar a submissão de projetos.", "error")
        return redirect(url_for('login'))

    if request.method == 'POST':
        imagem_path = None
        if 'logo' in request.files:
            file = request.files['logo']
            if file and file.filename != '':
                imagem_path = upload_file_to_supabase(file)

        nova_submissao = Submission(
            nome_projeto=request.form.get("nome_projeto"),
            categoria=request.form.get("categoria"),
            descricao=request.form.get("descricao"),
            proponente=request.form.get("proponente"),
            email=request.form.get("email"),
            status=request.form.get("status") or "EM ANÁLISE",
            username=session['user'],
            imagem=imagem_path
        )
        db.session.add(nova_submissao)
        db.session.commit()

        flash("✅ Sua proposta de projeto foi submetida e será analisada!", "success")
        return redirect(url_for("submissao"))

    return render_template('submissao.html')

@app.route('/submissao/editar/<int:sub_id>', methods=['GET', 'POST'])
def editar_submissao(sub_id):
    if not session.get('logged_in'):
        flash("⚠️ Você precisa estar logado.", "error")
        return redirect(url_for('login'))
        
    subm = Submission.query.get(sub_id)
    if not subm:
        abort(404)
        
    # Apenas o dono ou admin pode editar
    if subm.username != session['user'] and session.get('role') != 'admin':
        flash("⚠️ Acesso negado.", "error")
        return redirect(url_for('perfil'))
        
    # Apenas se estiver em análise
    if subm.status != 'EM ANÁLISE' and session.get('role') != 'admin':
        flash("⚠️ Essa proposta já foi avaliada e não pode mais ser editada.", "error")
        return redirect(url_for('perfil'))
        
    if request.method == 'POST':
        subm.nome_projeto = request.form.get("nome_projeto")
        subm.categoria = request.form.get("categoria")
        subm.descricao = request.form.get("descricao")
        subm.proponente = request.form.get("proponente")
        subm.email = request.form.get("email")
        
        if 'logo' in request.files:
            file = request.files['logo']
            if file and file.filename != '':
                subm.imagem = upload_file_to_supabase(file)
                
        db.session.commit()
        flash("✅ Proposta de projeto atualizada com sucesso!", "success")
        return redirect(url_for("perfil"))
        
    return render_template('submissao_editar.html', submissao=subm)

@app.route('/submissao/excluir/<int:sub_id>')
def excluir_submissao(sub_id):
    if not session.get('logged_in'):
        flash("⚠️ Você precisa estar logado.", "error")
        return redirect(url_for('login'))
        
    subm = Submission.query.get(sub_id)
    if not subm:
        abort(404)
        
    # Apenas o dono ou admin pode excluir
    if subm.username != session['user'] and session.get('role') != 'admin':
        flash("⚠️ Acesso negado.", "error")
        return redirect(url_for('perfil'))
        
    # Apenas se estiver em análise
    if subm.status != 'EM ANÁLISE' and session.get('role') != 'admin':
        flash("⚠️ Essa proposta já foi avaliada e não pode mais ser excluída.", "error")
        return redirect(url_for('perfil'))
        
    db.session.delete(subm)
    db.session.commit()
    flash("🗑️ Proposta de projeto excluída com sucesso!", "success")
    return redirect(url_for("perfil"))

# ==========================================
# Geração de Certificados PDF (ReportLab)
# ==========================================
def gerar_pdf_certificado(projeto, username):
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=landscape(letter), 
        rightMargin=40, 
        leftMargin=40, 
        topMargin=40, 
        bottomMargin=40
    )
    story = []
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CertTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=28,
        leading=34,
        textColor=colors.HexColor('#7A1BB5'),
        alignment=1, # Centralizado
        spaceAfter=20
    )
    
    body_style = ParagraphStyle(
        'CertBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=16,
        leading=24,
        textColor=colors.HexColor('#222222'),
        alignment=1, # Centralizado
        spaceAfter=20
    )
    
    meta_style = ParagraphStyle(
        'CertMeta',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#666666'),
        alignment=1, # Centralizado
        spaceAfter=50
    )
    
    story.append(Spacer(1, 40))
    story.append(Paragraph("CERTIFICADO DE CONCLUSÃO", title_style))
    story.append(Spacer(1, 20))
    
    texto_certificado = f"Certificamos que o(a) aluno(a) <b>{username}</b> participou e concluiu com êxito as atividades do projeto de extensão <b>{projeto.titulo}</b> na categoria <b>{projeto.categoria}</b>, sob a orientação do professor orientador <b>{projeto.professor}</b>."
    story.append(Paragraph(texto_certificado, body_style))
    story.append(Spacer(1, 10))
    
    data_conclusao = datetime.now().strftime('%d de %B de %Y')
    meses = {
        'January': 'Janeiro', 'February': 'Fevereiro', 'March': 'Março', 'April': 'Abril',
        'May': 'Maio', 'June': 'Junho', 'July': 'Julho', 'August': 'Agosto',
        'September': 'Setembro', 'October': 'Outubro', 'November': 'Novembro', 'December': 'Dezembro'
    }
    for eng, pt in meses.items():
        data_conclusao = data_conclusao.replace(eng, pt)
        
    story.append(Paragraph(f"Emitido em Brasília - DF, {data_conclusao}.", meta_style))
    story.append(Spacer(1, 20))
    
    sig_style = ParagraphStyle(
        'CertSig',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        alignment=1
    )
    
    sig_table_data = [
        [
            Paragraph("_____________________________<br>Coordenação de TI<br>SisCPTI - UniCEUB", sig_style),
            Paragraph(f"_____________________________<br>Professor Orientador<br>{projeto.professor}", sig_style)
        ]
    ]
    sig_table = Table(sig_table_data, colWidths=[300, 300])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    
    story.append(sig_table)
    
    def draw_border(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#7A1BB5'))
        canvas.setLineWidth(5)
        canvas.rect(20, 20, doc.pagesize[0]-40, doc.pagesize[1]-40)
        canvas.setStrokeColor(colors.HexColor('#FFC107'))
        canvas.setLineWidth(1.5)
        canvas.rect(25, 25, doc.pagesize[0]-50, doc.pagesize[1]-50)
        canvas.restoreState()
        
    doc.build(story, onFirstPage=draw_border)
    buffer.seek(0)
    return buffer.getvalue()

@app.route('/projeto/<int:projeto_id>/certificado')
def download_certificado(projeto_id):
    if not session.get('logged_in'):
        flash("Você precisa estar logado.", "error")
        return redirect(url_for('login'))
        
    projeto = Project.query.get(projeto_id)
    if not projeto:
        abort(404)
        
    username = session['user']
    if projeto.status != 'CONCLUÍDO' and session.get('role') != 'admin':
        flash("O certificado só fica disponível para projetos CONCLUÍDOS.", "error")
        return redirect(url_for('workspace', projeto_id=projeto_id))
        
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    is_owner = (projeto.owner_username == username)
    is_admin = (session.get('role') == 'admin')
    
    if not is_owner and not is_admin and username not in membros:
        flash("Você não tem permissão para acessar este certificado.", "error")
        return redirect(url_for('perfil'))
        
    pdf_data = gerar_pdf_certificado(projeto, username)
    return send_file(
        BytesIO(pdf_data),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'certificado_projeto_{projeto.id}.pdf'
    )

# ==========================================
# APIs do Quadro Kanban
# ==========================================
@app.route('/api/projeto/<int:projeto_id>/tasks')
def api_list_tasks(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
        
    projeto = Project.query.get(projeto_id)
    if not projeto:
        return jsonify({"error": "Project not found"}), 404
        
    username = session['user']
    user_obj = User.query.filter_by(username=username).first()
    
    is_orientador = (projeto.professor_id == user_obj.id if user_obj and projeto.professor_id else False)
    is_owner = (projeto.owner_username == username) or is_orientador
    is_admin = (session.get('role') == 'admin')
    is_coord = (session.get('role') == 'coordenador')
    
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    if not is_owner and not is_admin and not is_coord and username not in membros and session.get('role') != 'cliente':
        return jsonify({"error": "Forbidden"}), 403
        
    tasks = Task.query.filter_by(projeto_id=projeto_id).all()
    tasks_list = []
    for t in tasks:
        import json
        tasks_list.append({
            "id": t.id,
            "titulo": t.titulo,
            "descricao": t.descricao or '',
            "status": t.status,
            "assigned_username": t.assigned_username or '',
            "deadline": t.deadline.strftime('%Y-%m-%d') if t.deadline else '',
            "checklist": json.loads(t.checklist) if t.checklist else []
        })
    return jsonify(tasks_list)

@app.route('/api/projeto/<int:projeto_id>/tasks/criar', methods=['POST'])
def api_criar_task(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
        
    projeto = Project.query.get(projeto_id)
    if not projeto:
        return jsonify({"error": "Project not found"}), 404
        
    username = session['user']
    user_obj = User.query.filter_by(username=username).first()
    role = session.get('role')
    
    is_orientador = (projeto.professor_id == user_obj.id if user_obj and projeto.professor_id else False)
    is_owner = (projeto.owner_username == username) or is_orientador
    is_admin = (role == 'admin')
    
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    is_lider = (role == 'lider') or (username in membros and role == 'lider')
    
    if not is_owner and not is_admin and not is_lider:
        return jsonify({"error": "Apenas Líderes (Scrum Master), Administradores ou Orientadores podem criar tarefas."}), 403
        
    titulo = request.form.get('titulo')
    descricao = request.form.get('descricao')
    assigned_username = request.form.get('assigned_username')
    deadline_str = request.form.get('deadline')
    checklist_str = request.form.get('checklist')
    
    if not titulo:
        return jsonify({"error": "Título é obrigatório"}), 400
        
    deadline = None
    if deadline_str:
        try:
            deadline = datetime.strptime(deadline_str, '%Y-%m-%d').date()
        except ValueError:
            pass
            
    task = Task(
        projeto_id=projeto_id,
        titulo=titulo,
        descricao=descricao,
        status='todo',
        assigned_username=assigned_username if assigned_username else None,
        deadline=deadline,
        checklist=checklist_str
    )
    db.session.add(task)
    db.session.commit()
    
    import json
    return jsonify({
        "status": "success",
        "task": {
            "id": task.id,
            "titulo": task.titulo,
            "descricao": task.descricao or '',
            "status": task.status,
            "assigned_username": task.assigned_username or '',
            "deadline": task.deadline.strftime('%Y-%m-%d') if task.deadline else '',
            "checklist": json.loads(task.checklist) if task.checklist else []
        }
    })

@app.route('/api/projeto/<int:projeto_id>/tasks/<int:task_id>/mover', methods=['POST'])
def api_mover_task(projeto_id, task_id):
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
        
    projeto = Project.query.get(projeto_id)
    if not projeto:
        return jsonify({"error": "Project not found"}), 404
        
    task = Task.query.filter_by(id=task_id, projeto_id=projeto_id).first()
    if not task:
        return jsonify({"error": "Task not found"}), 404
        
    username = session['user']
    role = session.get('role')
    
    if role in ['cliente', 'coordenador']:
        return jsonify({"error": "Clientes e Coordenadores possuem apenas acesso de leitura ao Kanban."}), 403
        
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    user_obj = User.query.filter_by(username=username).first()
    is_orientador = (projeto.professor_id == user_obj.id if user_obj and projeto.professor_id else False)
    is_owner = (projeto.owner_username == username) or is_orientador
    is_admin = (role == 'admin')
    is_member = (username in membros)
    
    if not is_owner and not is_admin and not is_member:
        return jsonify({"error": "Acesso negado."}), 403
        
    novo_status = request.form.get('status')
    if novo_status not in ['todo', 'doing', 'done']:
        return jsonify({"error": "Status inválido"}), 400
        
    task.status = novo_status
    if novo_status == 'done':
        task.completed_at = datetime.utcnow()
    else:
        task.completed_at = None
        
    db.session.commit()
    return jsonify({"status": "success", "task_id": task.id, "new_status": task.status})

@app.route('/api/projeto/<int:projeto_id>/tasks/<int:task_id>/editar', methods=['POST'])
def api_editar_task(projeto_id, task_id):
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
        
    projeto = Project.query.get(projeto_id)
    if not projeto:
        return jsonify({"error": "Project not found"}), 404
        
    task = Task.query.filter_by(id=task_id, projeto_id=projeto_id).first()
    if not task:
        return jsonify({"error": "Task not found"}), 404
        
    username = session['user']
    role = session.get('role')
    
    user_obj = User.query.filter_by(username=username).first()
    is_orientador = (projeto.professor_id == user_obj.id if user_obj and projeto.professor_id else False)
    is_owner = (projeto.owner_username == username) or is_orientador
    is_admin = (role == 'admin')
    
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    is_lider = (role == 'lider') or (username in membros and role == 'lider')
    
    if not is_owner and not is_admin and not is_lider:
        return jsonify({"error": "Apenas Líderes, Administradores ou Orientadores podem editar tarefas."}), 403
        
    titulo = request.form.get('titulo')
    descricao = request.form.get('descricao')
    assigned_username = request.form.get('assigned_username')
    deadline_str = request.form.get('deadline')
    checklist_str = request.form.get('checklist')
    
    if titulo:
        task.titulo = titulo
    task.descricao = descricao
    task.assigned_username = assigned_username if assigned_username else None
    
    if deadline_str:
        try:
            task.deadline = datetime.strptime(deadline_str, '%Y-%m-%d').date()
        except ValueError:
            task.deadline = None
    else:
        task.deadline = None
        
    if checklist_str is not None:
        task.checklist = checklist_str
        
    db.session.commit()
    import json
    return jsonify({
        "status": "success",
        "task": {
            "id": task.id,
            "titulo": task.titulo,
            "descricao": task.descricao or '',
            "status": task.status,
            "assigned_username": task.assigned_username or '',
            "deadline": task.deadline.strftime('%Y-%m-%d') if task.deadline else '',
            "checklist": json.loads(task.checklist) if task.checklist else []
        }
    })

@app.route('/api/projeto/<int:projeto_id>/tasks/<int:task_id>/excluir', methods=['POST'])
def api_excluir_task(projeto_id, task_id):
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
        
    projeto = Project.query.get(projeto_id)
    if not projeto:
        return jsonify({"error": "Project not found"}), 404
        
    task = Task.query.filter_by(id=task_id, projeto_id=projeto_id).first()
    if not task:
        return jsonify({"error": "Task not found"}), 404
        
    username = session['user']
    role = session.get('role')
    
    user_obj = User.query.filter_by(username=username).first()
    is_orientador = (projeto.professor_id == user_obj.id if user_obj and projeto.professor_id else False)
    is_owner = (projeto.owner_username == username) or is_orientador
    is_admin = (role == 'admin')
    
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    is_lider = (role == 'lider') or (username in membros and role == 'lider')
    
    if not is_owner and not is_admin and not is_lider:
        return jsonify({"error": "Apenas Líderes, Administradores ou Orientadores podem excluir tarefas."}), 403
        
    db.session.delete(task)
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/projeto/<int:projeto_id>/metrics')
def api_projeto_metrics(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
        
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        return jsonify({"error": "Project not found"}), 444
        
    username = session['user']
    user_obj = User.query.filter_by(username=username).first()
    is_orientador = (projeto_db.professor_id == user_obj.id if user_obj and projeto_db.professor_id else False)
    is_owner = (projeto_db.owner_username == username) or is_orientador
    role = session.get('role')
    is_admin = (role == 'admin')
    is_coord = (role == 'coordenador')
    is_cliente_owner = (role in ['cliente', 'empresa'] and projeto_db.owner_username == username)
    
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    if not is_owner and not is_admin and not is_coord and not is_cliente_owner and username not in membros:
        return jsonify({"error": "Forbidden"}), 403
        
    tasks = Task.query.filter_by(projeto_id=projeto_id).all()
    tasks_data = []
    for t in tasks:
        tasks_data.append({
            "id": t.id,
            "titulo": t.titulo,
            "status": t.status,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            "deadline": t.deadline.isoformat() if t.deadline else None
        })
        
    return jsonify(tasks_data)

# ==========================================
# Eventos do SocketIO para o Chat
# ==========================================
from app_instance import socketio
from flask_socketio import join_room

@socketio.on('join')
def on_join(data):
    projeto_id = data.get('projeto_id')
    if projeto_id:
        room = str(projeto_id)
        join_room(room)


