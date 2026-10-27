# -------------------------------------------------------------------
# SisCPTI - Sistema de Gestão do Caderno de Projetos de TI
# Copyright (c) 2026 Equipe SisCPTI (CEUB). Todos os direitos reservados.
# Autores: Arthur Grangeiro, Davi Souza, Guilherme Gouveia,
#          Guilherme Oliveira Ribeiro Soares
# Software proprietário. Uso, cópia ou distribuição proibidos sem
# autorização dos autores. Ver arquivo LICENSE.
# -------------------------------------------------------------------

from flask import request, redirect, url_for, flash, session, abort, jsonify, send_file, g
from werkzeug.utils import secure_filename
from datetime import datetime
import os, uuid, json
from io import BytesIO

from app_instance import app
from models import db, Project, Application, Submission, Message, Notification, Rating, Task, User
from utils import log_atividade, upload_file_to_supabase, STATUS_ABERTOS_CANDIDATURA

# =========================
# Catálogo e Detalhes
# =========================
@app.route('/api/projetos', methods=['GET'])
def api_projetos():
    try:
        tag_filter = request.args.get('tag', '').strip()
        page = request.args.get('page', 1, type=int)
        per_page = 6
        
        query = Project.query
        if tag_filter:
            query = query.filter(Project.tags.ilike(f'%{tag_filter}%'))
            
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        unique_tags = set()
        for (tags_col,) in db.session.query(Project.tags).filter(Project.tags.isnot(None)).all():
            if tags_col:
                for t in tags_col.split(','):
                    cleaned = t.strip()
                    if cleaned:
                        unique_tags.add(cleaned)
                        
        return jsonify({
            "status": "success",
            "projetos": [p.to_dict() for p in pagination.items],
            "tags": sorted(list(unique_tags)),
            "page": page,
            "total_pages": pagination.pages,
            "total_items": pagination.total
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": f"Erro ao listar projetos: {str(e)}"
        }), 500

@app.route('/api/projeto/<int:projeto_id>', methods=['GET'])
def api_projeto_detalhes(projeto_id):
    try:
        projeto_db = Project.query.get(projeto_id)
        if not projeto_db:
            return jsonify({"status": "error", "message": "Projeto não encontrado"}), 404
        return jsonify({"status": "success", "projeto": projeto_db.to_dict()})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": f"Erro ao carregar detalhes do projeto: {str(e)}"
        }), 500

# =========================
# Candidaturas de Alunos
# =========================
@app.route('/api/projeto/<int:projeto_id>/candidatar', methods=['POST'])
def api_candidatar(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Não autenticado."}), 401

    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        return jsonify({"status": "error", "message": "Projeto não encontrado."}), 404

    role = session.get('role')
    if role not in ('aluno', 'lider', 'user'):
        return jsonify({"status": "error", "message": "Apenas alunos podem se candidatar a projetos."}), 403

    if projeto_db.status not in STATUS_ABERTOS_CANDIDATURA:
        return jsonify({"status": "error", "message": "Este projeto não está recebendo candidaturas."}), 400

    data = request.get_json(silent=True) or {}
    motivo = str(data.get('motivo') or '').strip()
    experiencia = str(data.get('experiencia') or '').strip()
    if not motivo or not experiencia:
        return jsonify({"status": "error", "message": "Informe sua motivação e sua experiência."}), 400

    if Application.query.filter_by(projeto_id=projeto_id, user_id=g.uid).first():
        return jsonify({"status": "error", "message": "Você já se candidatou a este projeto."}), 409

    nova_cand = Application(
        projeto_id=projeto_id,
        user_id=g.uid,
        username=session['user'],
        motivo=motivo,
        experiencia=experiencia
    )
    db.session.add(nova_cand)
    
    destinatarios_notificados = set()
    if projeto_db.owner_username:
        dono_obj = User.query.filter_by(username=projeto_db.owner_username).first()
        link_dono = "/admin?tab=candidaturas" if (dono_obj and dono_obj.role == 'admin') else "/perfil"
        db.session.add(Notification(
            user_id=dono_obj.id if dono_obj else projeto_db.owner_id,
            username=projeto_db.owner_username,
            mensagem=f"👤 {session['user']} se candidatou ao projeto '{projeto_db.titulo}'!",
            link=link_dono
        ))
        destinatarios_notificados.add(projeto_db.owner_username)

    if projeto_db.orientador and projeto_db.orientador.username not in destinatarios_notificados:
        db.session.add(Notification(
            user_id=projeto_db.orientador.id,
            username=projeto_db.orientador.username,
            mensagem=f"👤 {session['user']} se candidatou ao projeto '{projeto_db.titulo}' que você orienta!",
            link="/perfil"
        ))
        destinatarios_notificados.add(projeto_db.orientador.username)

    for admin_u in User.query.filter_by(role='admin').all():
        if admin_u.username not in destinatarios_notificados:
            db.session.add(Notification(
                user_id=admin_u.id,
                username=admin_u.username,
                mensagem=f"👤 Nova candidatura de @{session['user']} ao projeto '{projeto_db.titulo}'.",
                link="/admin?tab=candidaturas"
            ))
            destinatarios_notificados.add(admin_u.username)
        
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Você já se candidatou a este projeto."}), 409
    return jsonify({"status": "success", "message": "Candidatura enviada com sucesso!"})

# =========================
# Perfil e Ações do Dono
# =========================
@app.route('/api/perfil', methods=['GET'])
def api_perfil():
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Não autenticado."}), 401
        
    username = session['user']
    user_obj = User.query.filter_by(username=username).first()
    user_role = session.get('role') or (user_obj.role if user_obj else 'aluno')

    minhas_candidaturas = [{"id": c.id, "projeto_id": c.projeto_id, "projeto": c.projeto.titulo if c.projeto else "", "status": c.status} for c in Application.query.filter_by(user_id=g.uid).all()]
    meus_projetos = [p.to_dict() for p in Project.query.filter_by(owner_id=g.uid).all()]
    minhas_submissoes = [s.to_dict() for s in Submission.query.filter_by(user_id=g.uid).all()]
    
    projetos_orientados = []
    if user_obj and (user_role == 'professor' or user_obj.role == 'professor'):
        orient_objs = Project.query.filter(
            (Project.professor_id == user_obj.id)
        ).all()
        projetos_orientados = [p.to_dict() for p in orient_objs]
        existing_ids = {p['id'] for p in meus_projetos}
        for op in projetos_orientados:
            if op['id'] not in existing_ids:
                meus_projetos.append(op)

    recomendacoes = []
    if user_role in ['aluno', 'lider', 'user']:
        if user_obj and user_obj.interesses:
            interesses_list = [i.strip().lower() for i in user_obj.interesses.split(',') if i.strip()]
            if interesses_list:
                candidatados_ids = [c['projeto_id'] for c in minhas_candidaturas]
                all_projs = Project.query.filter(Project.status.in_(STATUS_ABERTOS_CANDIDATURA)).all()
                
                project_scores = []
                for p in all_projs:
                    if p.id in candidatados_ids:
                        continue
                    p_tags = [t.strip().lower() for t in p.tags.split(',') if t.strip()] if p.tags else []
                    overlap = len(set(interesses_list).intersection(set(p_tags)))
                    texto_proj = f"{p.titulo} {p.categoria} {p.descricao_curta}".lower()
                    overlap += len([i for i in interesses_list if i not in p_tags and i in texto_proj])
                    if overlap > 0:
                        project_scores.append((p, overlap))
                
                project_scores.sort(key=lambda x: x[1], reverse=True)
                recomendacoes = [item[0].to_dict() for item in project_scores[:3]]
                
    return jsonify({
        "status": "success",
        "data": {
            "role": user_role,
            "minhas_candidaturas": minhas_candidaturas,
            "meus_projetos": meus_projetos,
            "projetos_orientados": projetos_orientados,
            "minhas_submissoes": minhas_submissoes,
            "recomendacoes": recomendacoes
        }
    })

@app.route('/api/perfil/candidatura/<int:cand_id>/<acao>', methods=['POST'])
@app.route('/perfil/candidatura/<int:cand_id>/<acao>', methods=['POST'])
@app.route('/api/admin/candidatura/<int:cand_id>/<acao>', methods=['POST'])
@app.route('/api/candidatura/<int:cand_id>/<acao>', methods=['POST'])
def dono_acao_candidatura(cand_id, acao):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Não autenticado."}), 401
        
    cand = Application.query.get(cand_id)
    if not cand:
        return jsonify({"status": "error", "message": "Candidatura não encontrada."}), 404
        
    ac = acesso_projeto(cand.projeto)
    if not (ac['is_owner'] or ac['is_admin'] or ac['is_coord']):
        return jsonify({"status": "error", "message": "Acesso negado."}), 403
        
    if acao == 'aprovar':
        cand.status = 'APROVADA'
        notif = Notification(
            user_id=cand.user_id,
            username=cand.username,
            mensagem=f"🎉 Sua candidatura para o projeto '{cand.projeto.titulo}' foi APROVADA!",
            link=f"/workspace/{cand.projeto_id}"
        )
        db.session.add(notif)
    elif acao == 'rejeitar':
        cand.status = 'REJEITADA'
        notif = Notification(
            user_id=cand.user_id,
            username=cand.username,
            mensagem=f"⚠️ Sua candidatura para o projeto '{cand.projeto.titulo}' foi recusada.",
            link="/perfil"
        )
        db.session.add(notif)
    elif acao == 'reavaliar':
        cand.status = 'PENDENTE'
    else:
        return jsonify({"status": "error", "message": "Ação inválida."}), 400
        
    db.session.commit()
    return jsonify({"status": "success", "new_status": cand.status, "message": f"Candidatura marcada como {cand.status}!"})

@app.route('/api/candidatura/<int:cand_id>', methods=['GET'])
def api_obter_candidatura(cand_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Não autenticado."}), 401
    cand = Application.query.get(cand_id)
    if not cand:
        return jsonify({"status": "error", "message": "Candidatura não encontrada."}), 404
    if cand.user_id != g.uid and session.get('role') != 'admin' and cand.projeto.owner_id != g.uid:
        return jsonify({"status": "error", "message": "Acesso negado."}), 403
    return jsonify({
        "status": "success",
        "candidatura": {
            "id": cand.id,
            "projeto_id": cand.projeto_id,
            "projeto": {"id": cand.projeto.id, "titulo": cand.projeto.titulo} if cand.projeto else None,
            "motivo": cand.motivo,
            "experiencia": cand.experiencia,
            "status": cand.status
        }
    })

@app.route('/api/candidatura/<int:cand_id>/editar', methods=['POST', 'PUT'])
@app.route('/perfil/candidatura/<int:cand_id>/editar', methods=['GET', 'POST', 'PUT'])
def editar_candidatura(cand_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Você precisa estar logado."}), 401
        
    cand = Application.query.get(cand_id)
    if not cand:
        return jsonify({"status": "error", "message": "Candidatura não encontrada."}), 404
        
    # Apenas o dono ou admin pode editar
    if cand.user_id != g.uid and session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Acesso negado."}), 403
        
    # Apenas se estiver pendente
    if cand.status != 'PENDENTE' and session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Essa candidatura já foi avaliada e não pode mais ser editada."}), 400
        
    if request.method in ['POST', 'PUT']:
        data = request.get_json(silent=True) or request.form
        cand.motivo = data.get('motivo', cand.motivo)
        cand.experiencia = data.get('experiencia', cand.experiencia)
        db.session.commit()
        return jsonify({"status": "success", "message": "Candidatura atualizada com sucesso!", "cand": {"id": cand.id, "motivo": cand.motivo, "experiencia": cand.experiencia, "status": cand.status}})
        
    return jsonify({"status": "success", "candidatura": {"id": cand.id, "motivo": cand.motivo, "experiencia": cand.experiencia, "status": cand.status}})

@app.route('/api/perfil/candidatura/<int:cand_id>/cancelar', methods=['POST', 'DELETE'])
@app.route('/perfil/candidatura/<int:cand_id>/cancelar', methods=['POST', 'DELETE'])
def cancelar_candidatura(cand_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Você precisa estar logado."}), 401
        
    cand = Application.query.get(cand_id)
    if not cand:
        return jsonify({"status": "error", "message": "Candidatura não encontrada."}), 404
        
    # Apenas o dono ou admin pode cancelar
    if cand.user_id != g.uid and session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Acesso negado."}), 403
        
    # Apenas se estiver pendente
    if cand.status != 'PENDENTE' and session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Essa candidatura já foi avaliada e não pode mais ser cancelada."}), 400
        
    db.session.delete(cand)
    db.session.commit()
    return jsonify({"status": "success", "message": "Candidatura cancelada com sucesso!"})

# =========================
# Workspace e Chat
# =========================
@app.route('/api/projeto/<int:projeto_id>/workspace')
@app.route('/projeto/<int:projeto_id>/workspace')
def workspace(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Acesso negado. Faça login."}), 401
        
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        return jsonify({"status": "error", "message": "Projeto não encontrado."}), 404
        
    if not acesso_projeto(projeto_db)['pode_ver']:
        return jsonify({"status": "error", "message": "Acesso negado. Você não é membro aprovado deste projeto."}), 403

    membros = [c.username for c in Application.query.filter(Application.projeto_id == projeto_id, Application.status.in_(['APROVADA', 'APROVADO'])).all()]
    mensagens = Message.query.filter_by(projeto_id=projeto_id).order_by(Message.data_envio.asc()).all()
    return jsonify({
        "status": "success",
        "projeto": projeto_db.to_dict(),
        "membros": membros,
        "mensagens": [{
            "id": m.id,
            "username": m.username,
            "texto": m.texto,
            "arquivo": m.arquivo,
            "data_envio": m.data_envio.strftime("%d/%m/%Y %H:%M") if m.data_envio else ""
        } for m in mensagens]
    })

@app.route('/api/projeto/<int:projeto_id>/workspace/mensagens')
@app.route('/projeto/<int:projeto_id>/workspace/mensagens')
def workspace_mensagens_json(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        return jsonify({"status": "error", "message": "Project not found"}), 404
        
    if not acesso_projeto(projeto_db)['pode_ver']:
        return jsonify({"status": "error", "message": "Forbidden"}), 403

    mensagens = Message.query.filter_by(projeto_id=projeto_id).order_by(Message.data_envio.asc()).all()
    output = []
    for msg in mensagens:
        output.append({
            "id": msg.id,
            "username": msg.username,
            "texto": msg.texto,
            "arquivo": msg.arquivo,
            "data_envio": msg.data_envio.strftime('%d/%m %H:%M') if msg.data_envio else ""
        })
    return jsonify(output)

@app.route('/api/projeto/<int:projeto_id>/workspace/enviar', methods=['POST'])
@app.route('/api/projeto/<int:projeto_id>/workspace/enviar_ajax', methods=['POST'])
@app.route('/projeto/<int:projeto_id>/workspace/enviar', methods=['POST'])
@app.route('/projeto/<int:projeto_id>/workspace/enviar_ajax', methods=['POST'])
def enviar_mensagem_ajax(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Não autenticado"}), 401
        
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        return jsonify({"status": "error", "message": "Projeto não encontrado"}), 404
        
    username = session['user']
    if not acesso_projeto(projeto_db)['pode_ver']:
        return jsonify({"status": "error", "message": "Acesso negado"}), 403

    membros = [c.username for c in Application.query.filter(Application.projeto_id == projeto_id, Application.status.in_(['APROVADA', 'APROVADO'])).all()]
    data = request.get_json(silent=True) or request.form
    texto = data.get('texto')
    arquivo_path = None
    if 'arquivo' in request.files:
        file = request.files['arquivo']
        if file and file.filename != '':
            arquivo_path = upload_file_to_supabase(file)
            
    if texto or arquivo_path:
        nova_msg = Message(
            projeto_id=projeto_id,
            user_id=g.uid,
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
                        link=f"/workspace/{projeto_id}",
                        lida=False
                    )
                    db.session.add(notif)
            db.session.commit()
            
        msg_dict = {
            "id": nova_msg.id,
            "username": nova_msg.username,
            "texto": nova_msg.texto,
            "arquivo": nova_msg.arquivo,
            "data_envio": nova_msg.data_envio.strftime('%d/%m/%Y %H:%M') if nova_msg.data_envio else ""
        }
        
        return jsonify({
            "status": "success",
            "message": msg_dict
        })
        
    return jsonify({"status": "error", "message": "Mensagem vazia"}), 400

# =========================
# Sistema de Avaliações
# =========================
@app.route('/api/projeto/<int:projeto_id>/avaliar', methods=['POST'])
@app.route('/projeto/<int:projeto_id>/avaliar', methods=['POST'])
def avaliar_projeto(projeto_id):
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Não autenticado'}), 401

    proj = Project.query.get(projeto_id)
    if not proj:
        return jsonify({'status': 'error', 'message': 'Projeto não encontrado'}), 404

    ac = acesso_projeto(proj)
    if not (ac['is_member'] or ac['is_owner']):
        return jsonify({'status': 'error', 'message': 'Apenas integrantes do projeto podem avaliá-lo.'}), 403

    data = request.get_json(silent=True) or request.form

    def ler_nota(chave, padrao):
        try:
            valor = int(data.get(chave, padrao))
        except (ValueError, TypeError):
            return None
        return valor if 1 <= valor <= 5 else None

    nota = ler_nota('nota', 0)
    nota_org = ler_nota('nota_organizacao', 5)
    nota_ori = ler_nota('nota_orientacao', 5)
    nota_apr = ler_nota('nota_aprendizado', 5)
    comentario = str(data.get('comentario', '') or '').strip()

    if None in (nota, nota_org, nota_ori, nota_apr):
        return jsonify({'status': 'error', 'message': 'Nota inválida. Escolha valores entre 1 e 5.'}), 400
    if len(comentario) > 1000:
        return jsonify({'status': 'error', 'message': 'O comentário deve ter no máximo 1000 caracteres.'}), 400

    ja_avaliou = Rating.query.filter_by(projeto_id=projeto_id, user_id=g.uid).first()
    if ja_avaliou:
        ja_avaliou.nota = nota
        ja_avaliou.nota_organizacao = nota_org
        ja_avaliou.nota_orientacao = nota_ori
        ja_avaliou.nota_aprendizado = nota_apr
        ja_avaliou.comentario = comentario
        ja_avaliou.data_criacao = datetime.utcnow()
        msg = "Avaliação atualizada com sucesso!"
    else:
        rating = Rating(
            projeto_id=projeto_id, 
            user_id=g.uid,
            username=session['user'], 
            nota=nota, 
            nota_organizacao=nota_org,
            nota_orientacao=nota_ori,
            nota_aprendizado=nota_apr,
            comentario=comentario
        )
        db.session.add(rating)
        msg = "Avaliação enviada com sucesso!"

    db.session.commit()
    log_atividade(session['user'], 'Avaliação enviada', f'Projeto #{projeto_id}, nota {nota}')
    return jsonify({'status': 'success', 'message': msg})

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
# Submissão de projetos
# =========================
@app.route('/api/submissao', methods=['POST'])
@app.route('/submissao', methods=['GET', 'POST'])
def submissao():
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Você precisa estar logado para acessar a submissão de projetos."}), 401

    if session.get('role') == 'admin':
        return jsonify({"status": "error", "message": "Administradores apenas gerenciam projetos e não submetem propostas."}), 403

    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        imagem_path = None
        if 'logo' in request.files:
            file = request.files['logo']
            if file and file.filename != '':
                imagem_path = upload_file_to_supabase(file)

        nova_submissao = Submission(
            nome_projeto=data.get("nome_projeto"),
            categoria=data.get("categoria"),
            descricao=data.get("descricao"),
            proponente=data.get("proponente"),
            email=data.get("email"),
            status=data.get("status") or "EM ANÁLISE",
            username=session['user'],
            user_id=g.uid,
            imagem=imagem_path
        )
        db.session.add(nova_submissao)

        staff_users = User.query.filter(User.role.in_(['admin', 'coordenador'])).all()
        for staff in staff_users:
            db.session.add(Notification(
                user_id=staff.id,
                username=staff.username,
                mensagem=f"📋 Nova proposta de projeto submetida por @{session['user']}: '{nova_submissao.nome_projeto}'.",
                link="/coordenador" if staff.role == 'coordenador' else "/admin?tab=submissoes"
            ))

        db.session.commit()

        return jsonify({
            "status": "success", 
            "message": "Sua proposta de projeto foi submetida e será analisada!",
            "id": nova_submissao.id,
            "submissao": nova_submissao.to_dict()
        })

    return jsonify({"status": "ready"})

@app.route('/api/submissao/<int:sub_id>', methods=['GET'])
def obter_submissao(sub_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Você precisa estar logado."}), 401
    subm = Submission.query.get(sub_id)
    if not subm:
        return jsonify({"status": "error", "message": "Proposta não encontrada."}), 404
    if subm.user_id != g.uid and session.get('role') not in ['admin', 'coordenador', 'professor']:
        return jsonify({"status": "error", "message": "Acesso negado."}), 403
    return jsonify({"status": "success", "submissao": subm.to_dict()})

@app.route('/api/submissao/<int:sub_id>/editar', methods=['POST', 'PUT'])
@app.route('/submissao/editar/<int:sub_id>', methods=['GET', 'POST', 'PUT'])
def editar_submissao(sub_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Você precisa estar logado."}), 401
        
    subm = Submission.query.get(sub_id)
    if not subm:
        return jsonify({"status": "error", "message": "Proposta não encontrada."}), 404
        
    # Apenas o dono ou admin pode editar
    if subm.user_id != g.uid and session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Acesso negado."}), 403
        
    # Apenas se estiver em análise
    if subm.status != 'EM ANÁLISE' and session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Essa proposta já foi avaliada e não pode mais ser editada."}), 400
        
    if request.method in ['POST', 'PUT']:
        data = request.get_json(silent=True) or request.form
        if 'nome_projeto' in data: subm.nome_projeto = data.get("nome_projeto")
        if 'categoria' in data: subm.categoria = data.get("categoria")
        if 'descricao' in data: subm.descricao = data.get("descricao")
        if 'proponente' in data: subm.proponente = data.get("proponente")
        if 'email' in data: subm.email = data.get("email")
        
        if 'logo' in request.files:
            file = request.files['logo']
            if file and file.filename != '':
                subm.imagem = upload_file_to_supabase(file)
                
        db.session.commit()
        return jsonify({"status": "success", "message": "Proposta de projeto atualizada com sucesso!", "submissao": subm.to_dict()})
        
    return jsonify({"status": "success", "submissao": subm.to_dict()})

@app.route('/api/submissao/<int:sub_id>/excluir', methods=['POST', 'DELETE'])
@app.route('/submissao/excluir/<int:sub_id>', methods=['POST', 'DELETE'])
def excluir_submissao(sub_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Você precisa estar logado."}), 401
        
    subm = Submission.query.get(sub_id)
    if not subm:
        return jsonify({"status": "error", "message": "Proposta não encontrada."}), 404
        
    # Apenas o dono ou admin pode excluir
    if subm.user_id != g.uid and session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Acesso negado."}), 403
        
    # Apenas se estiver em análise
    if subm.status != 'EM ANÁLISE' and session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Essa proposta já foi avaliada e não pode mais ser excluída."}), 400
        
    db.session.delete(subm)
    db.session.commit()
    return jsonify({"status": "success", "message": "Proposta de projeto excluída com sucesso!"})

# ==========================================
# Geração de Certificados PDF (ReportLab)
# ==========================================
def gerar_pdf_certificado(projeto, username):
    from xml.sax.saxutils import escape
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
    
    texto_certificado = f"Certificamos que o(a) aluno(a) <b>{escape(username)}</b> participou e concluiu com êxito as atividades do projeto de extensão <b>{escape(projeto.titulo or '')}</b> na categoria <b>{escape(projeto.categoria or '')}</b>, sob a orientação do professor orientador <b>{escape(projeto.professor or '')}</b>."
    story.append(Paragraph(texto_certificado, body_style))
    story.append(Spacer(1, 10))
    
    data_conclusao = (getattr(projeto, 'concluido_em', None) or datetime.utcnow()).strftime('%d de %B de %Y')
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
            Paragraph("_____________________________<br/>Coordenação de TI<br/>SisCPTI - UniCEUB", sig_style),
            Paragraph(f"_____________________________<br/>Professor Orientador<br/>{escape(projeto.professor or '')}", sig_style)
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

@app.route('/api/projeto/<int:projeto_id>/certificado')
@app.route('/projeto/<int:projeto_id>/certificado')
def download_certificado(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Você precisa estar logado."}), 401

    projeto = Project.query.get(projeto_id)
    if not projeto:
        return jsonify({"status": "error", "message": "Projeto não encontrado."}), 404

    username = session['user']
    ac = acesso_projeto(projeto)
    if not (ac['is_member'] or ac['is_admin']):
        return jsonify({"status": "error", "message": "Você não tem permissão para acessar este certificado."}), 403

    if projeto.status != 'CONCLUÍDO':
        return jsonify({"status": "error", "message": "O certificado só fica disponível para projetos CONCLUÍDOS."}), 400

    pdf_data = gerar_pdf_certificado(projeto, username)
    return send_file(
        BytesIO(pdf_data),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'certificado_projeto_{projeto.id}.pdf'
    )

# ==========================================
# Controle de acesso por projeto (fonte única)
# ==========================================
def _id_do_usuario(username):
    if not username:
        return None
    u = User.query.filter_by(username=username).first()
    return u.id if u else None


def acesso_projeto(projeto):
    """Papéis do usuário logado NESTE projeto (por id); o papel global sozinho não concede acesso."""
    uid = g.get('uid')
    role = session.get('role')
    is_orientador = bool(uid and projeto.professor_id and projeto.professor_id == uid)
    is_owner = bool(uid and projeto.owner_id == uid) or is_orientador
    is_admin = (role == 'admin')
    is_coord = (role == 'coordenador')
    is_member = bool(uid) and Application.query.filter(Application.projeto_id == projeto.id, Application.user_id == uid, Application.status.in_(['APROVADA', 'APROVADO'])).first() is not None
    return {
        'is_owner': is_owner,
        'is_admin': is_admin,
        'is_coord': is_coord,
        'is_member': is_member,
        'is_lider': is_member and role == 'lider',
        'pode_ver': is_owner or is_admin or is_coord or is_member,
        'pode_editar': is_owner or is_admin or is_member,
    }

# ==========================================
# APIs do Quadro Kanban
# ==========================================
@app.route('/api/projeto/<int:projeto_id>/tasks')
def api_list_tasks(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
    projeto = Project.query.get(projeto_id)
    if not projeto:
        return jsonify({"status": "error", "message": "Project not found"}), 404
        
    if not acesso_projeto(projeto)['pode_ver']:
        return jsonify({"status": "error", "message": "Forbidden"}), 403
        
    tasks = Task.query.filter_by(projeto_id=projeto_id).all()
    tasks_list = []
    for t in tasks:
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
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
    projeto = Project.query.get(projeto_id)
    if not projeto:
        return jsonify({"status": "error", "message": "Project not found"}), 404
        
    if not acesso_projeto(projeto)['pode_editar']:
        return jsonify({"status": "error", "message": "Apenas integrantes da equipe, administradores ou orientadores podem criar tarefas."}), 403
        
    data = request.get_json(silent=True) or request.form
    titulo = data.get('titulo')
    descricao = data.get('descricao')
    assigned_username = data.get('assigned_username')
    deadline_str = data.get('deadline')
    checklist_str = data.get('checklist')
    if isinstance(checklist_str, list):
        checklist_str = json.dumps(checklist_str)
    
    if not titulo:
        return jsonify({"status": "error", "message": "Título é obrigatório"}), 400
        
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
        assigned_user_id=_id_do_usuario(assigned_username),
        deadline=deadline,
        checklist=checklist_str
    )
    db.session.add(task)
    db.session.commit()
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
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
    projeto = Project.query.get(projeto_id)
    if not projeto:
        return jsonify({"status": "error", "message": "Project not found"}), 404
        
    task = Task.query.filter_by(id=task_id, projeto_id=projeto_id).first()
    if not task:
        return jsonify({"status": "error", "message": "Task not found"}), 404
        
    username = session['user']
    role = session.get('role')
    
    if role in ['cliente', 'coordenador']:
        return jsonify({"status": "error", "message": "Clientes e Coordenadores possuem apenas acesso de leitura ao Kanban."}), 403
        
    if not acesso_projeto(projeto)['pode_editar']:
        return jsonify({"status": "error", "message": "Acesso negado."}), 403

    data = request.get_json(silent=True) or request.form
    novo_status = data.get('status')
    if novo_status not in ['todo', 'doing', 'done']:
        return jsonify({"status": "error", "message": "Status inválido"}), 400
        
    task.status = novo_status
    if novo_status == 'done':
        task.completed_at = datetime.utcnow()
    else:
        task.completed_at = None
        
    db.session.commit()
    return jsonify({"status": "success", "task_id": task.id, "new_status": task.status})

@app.route('/api/projeto/<int:projeto_id>/tasks/<int:task_id>/editar', methods=['POST', 'PUT'])
def api_editar_task(projeto_id, task_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
    projeto = Project.query.get(projeto_id)
    if not projeto:
        return jsonify({"status": "error", "message": "Project not found"}), 404
        
    task = Task.query.filter_by(id=task_id, projeto_id=projeto_id).first()
    if not task:
        return jsonify({"status": "error", "message": "Task not found"}), 404
        
    if not acesso_projeto(projeto)['pode_editar']:
        return jsonify({"status": "error", "message": "Apenas integrantes do projeto, administradores ou orientadores podem editar tarefas."}), 403
        
    data = request.get_json(silent=True) or request.form
    titulo = data.get('titulo')
    descricao = data.get('descricao')
    assigned_username = data.get('assigned_username')
    deadline_str = data.get('deadline')
    checklist_str = data.get('checklist')
    if isinstance(checklist_str, list):
        checklist_str = json.dumps(checklist_str)
    
    if titulo:
        task.titulo = titulo
    if descricao is not None:
        task.descricao = descricao
    if 'assigned_username' in data:
        task.assigned_username = assigned_username if assigned_username else None
        task.assigned_user_id = _id_do_usuario(assigned_username)
    
    if deadline_str:
        try:
            task.deadline = datetime.strptime(deadline_str, '%Y-%m-%d').date()
        except ValueError:
            task.deadline = None
    elif 'deadline' in data and not deadline_str:
        task.deadline = None
        
    if checklist_str is not None:
        task.checklist = checklist_str
        
    db.session.commit()
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

@app.route('/api/projeto/<int:projeto_id>/tasks/<int:task_id>/excluir', methods=['POST', 'DELETE'])
@app.route('/api/projeto/<int:projeto_id>/tasks/<int:task_id>', methods=['DELETE'])
def api_excluir_task(projeto_id, task_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
    projeto = Project.query.get(projeto_id)
    if not projeto:
        return jsonify({"status": "error", "message": "Project not found"}), 404
        
    task = Task.query.filter_by(id=task_id, projeto_id=projeto_id).first()
    if not task:
        return jsonify({"status": "error", "message": "Task not found"}), 404
        
    ac = acesso_projeto(projeto)
    if not (ac['is_owner'] or ac['is_admin'] or ac['is_lider']):
        return jsonify({"status": "error", "message": "Apenas Líderes da equipe, Administradores ou Orientadores podem excluir tarefas."}), 403
        
    db.session.delete(task)
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/projeto/<int:projeto_id>/metrics')
def api_projeto_metrics(projeto_id):
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        return jsonify({"status": "error", "message": "Project not found"}), 404
        
    if not acesso_projeto(projeto_db)['pode_ver']:
        return jsonify({"status": "error", "message": "Forbidden"}), 403

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


