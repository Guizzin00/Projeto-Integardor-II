from flask import request, session, jsonify, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
import re
import uuid

from app_instance import app, base_dir
from models import db, User, PasswordReset, AccountVerification, Notification
from utils import log_atividade, enviar_email, email_template_ativacao, email_template_recuperacao, email_template_espera_aprovacao, get_frontend_url

# =========================
# Login e Cadastro (API)
# =========================
@app.route('/api/login', methods=['POST'])
def api_login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "Dados não fornecidos"}), 400

        user = data.get('user')
        password = data.get('password')

        usuario = User.query.filter_by(username=user).first()

        if usuario and check_password_hash(usuario.password, password):
            # Validação de contas aguardando homologação
            status_aprov = getattr(usuario, 'status_aprovacao', 'APROVADO') or 'APROVADO'
            if status_aprov == 'PENDENTE':
                return jsonify({
                    "status": "error", 
                    "message": f"Sua conta com perfil '{usuario.role.capitalize()}' está em análise aguardando validação de um coordenador ou administrador."
                }), 403

            if status_aprov == 'REJEITADO':
                return jsonify({
                    "status": "error", 
                    "message": f"A solicitação de cadastro para a conta '{usuario.username}' não foi homologada pela coordenação ou administração."
                }), 403

            if not usuario.ativo:
                return jsonify({"status": "error", "message": "Conta não ativada. Verifique seu e-mail para ativar."}), 403

            session['logged_in'] = True
            session['user'] = usuario.username
            session['role'] = usuario.role

            log_atividade(usuario.username, 'Login realizado')
            
            return jsonify({
                "status": "success", 
                "message": "Login realizado com sucesso",
                "user": perfil_payload(usuario)
            })
        else:
            return jsonify({"status": "error", "message": "Usuário ou senha incorretos"}), 401
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Erro interno ao autenticar: {str(e)}"}), 500

@app.route('/api/cadastro', methods=['POST'])
def api_cadastro():
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Dados não fornecidos"}), 400

    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password')
    confirm = data.get('confirm')

    if not email or not username or not password:
        return jsonify({"status": "error", "message": "Preencha todos os campos."}), 400

    if password != confirm:
        return jsonify({"status": "error", "message": "As senhas não coincidem."}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"status": "error", "message": "Este nome de usuário já está em uso."}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"status": "error", "message": "Este e-mail já está associado a outra conta."}), 400

    requested_role = (data.get('role') or 'aluno').strip().lower()
    allowed_roles = ['aluno', 'professor', 'empresa', 'cliente']
    role = requested_role if requested_role in allowed_roles else 'aluno'

    if role in ['professor', 'empresa']:
        # Contas de Professor e Empresa passam por validação obrigatória
        novo_usuario = User(
            username=username, 
            email=email, 
            password=generate_password_hash(password), 
            role=role, 
            ativo=False,
            status_aprovacao='PENDENTE'
        )
        db.session.add(novo_usuario)
        db.session.commit()

        # Envia notificação interna para todos os Coordenadores e Admins
        try:
            staff_users = User.query.filter(User.role.in_(['admin', 'coordenador'])).all()
            role_nome = "Professor Orientador" if role == 'professor' else "Empresa Parceira"
            for staff in staff_users:
                notif = Notification(
                    username=staff.username,
                    mensagem=f"Nova solicitação de conta ({role_nome}): @{username}. Requer validação.",
                    link="/coordenador" if staff.role == 'coordenador' else "/admin"
                )
                db.session.add(notif)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"Erro ao disparar notificações de nova conta: {e}")

        log_atividade(username, f'Solicitou cadastro institucional como {role}')

        # Envia e-mail institucional informando que está em espera
        base_url = get_frontend_url() or request.host_url.rstrip('/')
        corpo = email_template_espera_aprovacao(username, role, email, base_url=base_url)
        enviar_email(email, 'Solicitação de Cadastro em Espera – SisCPTI · UniCEUB', corpo)

        return jsonify({
            "status": "success", 
            "message": f"Solicitação registrada com sucesso! Sua conta com perfil de {role.capitalize()} está em espera aguardando a validação de um coordenador ou administrador. Enviamos os detalhes para seu e-mail."
        })
    else:
        # Aluno e demais perfis padrão
        novo_usuario = User(
            username=username, 
            email=email, 
            password=generate_password_hash(password), 
            role=role, 
            ativo=False,
            status_aprovacao='APROVADO'
        )
        db.session.add(novo_usuario)
        db.session.commit()

        token = str(uuid.uuid4())
        expira = datetime.utcnow() + timedelta(days=1)
        verif = AccountVerification(username=username, token=token, expira_em=expira)
        db.session.add(verif)
        db.session.commit()

        # Gera o link apontando para o frontend React
        base_url = get_frontend_url() or request.host_url.rstrip('/')
        link = base_url + f"/verificar-conta/{token}"
        corpo = email_template_ativacao(username, link, base_url=base_url)
        enviar_email(email, 'Ativação de Conta Institucional – SisCPTI · UniCEUB', corpo)

        return jsonify({
            "status": "success", 
            "message": "Conta criada com sucesso! Verifique seu e-mail para ativar."
        })

@app.route('/api/verificar-conta/<token>', methods=['POST', 'GET'])
def api_verificar_conta(token):
    try:
        verification = AccountVerification.query.filter_by(token=token).first()
        if not verification:
            return jsonify({"status": "error", "message": "Link de ativação inválido ou já foi utilizado."}), 400

        # Compara datas respeitando timezone (PostgreSQL usa TIMESTAMPTZ)
        agora = datetime.utcnow()
        expira = verification.expira_em
        # Remove timezone info se presente para comparação segura
        if hasattr(expira, 'tzinfo') and expira.tzinfo is not None:
            expira = expira.replace(tzinfo=None)
        if expira < agora:
            db.session.delete(verification)
            db.session.commit()
            return jsonify({"status": "error", "message": "O link de ativação expirou. Faça um novo cadastro."}), 400

        user = User.query.filter_by(username=verification.username).first()
        if not user:
            return jsonify({"status": "error", "message": "Erro ao ativar: usuário não encontrado."}), 400

        user.ativo = True
        db.session.delete(verification)
        db.session.commit()
        log_atividade(user.username, 'Conta ativada')
        return jsonify({"status": "success", "message": "Conta ativada com sucesso! Você já pode fazer o login."})

    except Exception as e:
        print(f"Erro ao verificar conta: {e}")
        db.session.rollback()
        return jsonify({"status": "error", "message": "Erro interno ao ativar a conta. Tente novamente."}), 500


@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"status": "success", "message": "Logout realizado com sucesso."})

@app.route('/api/me', methods=['GET'])
def api_me():
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Não autenticado"}), 401
    
    user = User.query.filter_by(username=session['user']).first()
    if not user:
        return jsonify({"status": "error", "message": "Usuário não encontrado"}), 404
        
    return jsonify({"status": "success", "user": perfil_payload(user)})

def perfil_payload(user):
    return {
        "username": user.username,
        "email": user.email,
        "email_secundario": user.email_secundario or "",
        "role": user.role,
        "bio": user.bio,
        "interesses": user.interesses or ""
    }

def normalizar_interesses(texto):
    """Normaliza a lista separada por vírgula: remove vazios e duplicados, preservando a ordem."""
    vistos, itens = set(), []
    for item in (texto or '').replace(';', ',').split(','):
        item = item.strip()
        if item and item.lower() not in vistos:
            vistos.add(item.lower())
            itens.append(item)
    return ', '.join(itens)

def email_valido(valor):
    return bool(re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', valor))

@app.route('/api/perfil/editar', methods=['POST', 'PUT'])
def api_perfil_editar():
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "Não autenticado"}), 401

    user = User.query.filter_by(username=session['user']).first()
    if not user:
        return jsonify({"status": "error", "message": "Usuário não encontrado"}), 404
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"status": "error", "message": "Dados não enviados"}), 400

    email = (data.get('email') or '').strip()
    email_secundario = (data.get('email_secundario') or '').strip()
    bio = (data.get('bio') or '').strip()
    interesses = normalizar_interesses(data.get('interesses'))
    nova_senha = (data.get('nova_senha') or '').strip()
    confirmar_senha = (data.get('confirmar_senha') or '').strip()

    if len(interesses) > 300:
        return jsonify({"status": "error", "message": "Os interesses ultrapassam 300 caracteres. Remova alguns itens."}), 400
    if email and not email_valido(email):
        return jsonify({"status": "error", "message": "E-mail principal inválido."}), 400
    if email_secundario:
        if not email_valido(email_secundario):
            return jsonify({"status": "error", "message": "E-mail secundário inválido."}), 400
        if email_secundario.lower() == (email or user.email or '').lower():
            return jsonify({"status": "error", "message": "O e-mail secundário deve ser diferente do principal."}), 400

    if nova_senha:
        if nova_senha != confirmar_senha:
            return jsonify({"status": "error", "message": "As senhas não coincidem."}), 400
        if len(nova_senha) < 4:
            return jsonify({"status": "error", "message": "A senha deve ter pelo menos 4 caracteres."}), 400
        user.password = generate_password_hash(nova_senha)

    if email: user.email = email
    user.email_secundario = email_secundario or None
    user.bio = bio[:300] if bio else None
    user.interesses = interesses

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao salvar perfil: {e}")
        return jsonify({"status": "error", "message": "Não foi possível salvar o perfil. Tente novamente."}), 500

    log_atividade(user.username, 'Edição de Perfil')
    return jsonify({
        "status": "success",
        "message": "Perfil atualizado com sucesso!",
        "user": perfil_payload(user)
    })

@app.route('/api/recuperar-senha', methods=['POST'])
def api_recuperar_senha():
    data = request.get_json()
    email = data.get('email', '').strip()
    user = User.query.filter((User.email == email) | (User.email_secundario == email)).first() if email else None
    
    if user:
        PasswordReset.query.filter_by(username=user.username).delete()
        token = str(uuid.uuid4())
        expira = datetime.utcnow() + timedelta(hours=1)
        reset = PasswordReset(username=user.username, token=token, expira_em=expira)
        db.session.add(reset)
        db.session.commit()
        
        base_url = get_frontend_url() or request.host_url.rstrip('/')
        link = base_url + f"/redefinir-senha/{token}"
        corpo = email_template_recuperacao(user.username, link, base_url=base_url)
        enviar_email(email, 'Redefinição de Senha – SisCPTI · UniCEUB', corpo)
        
    return jsonify({"status": "success", "message": "Se o e-mail existir, um link de recuperação foi enviado."})

@app.route('/api/redefinir-senha/<token>', methods=['POST'])
def api_redefinir_senha(token):
    try:
        reset = PasswordReset.query.filter_by(token=token).first()
        if not reset:
            return jsonify({"status": "error", "message": "Link inválido ou já foi utilizado."}), 400

        # Fix timezone comparison (PostgreSQL TIMESTAMPTZ vs Python naive datetime)
        agora = datetime.utcnow()
        expira = reset.expira_em
        if hasattr(expira, 'tzinfo') and expira.tzinfo is not None:
            expira = expira.replace(tzinfo=None)
        if expira < agora:
            db.session.delete(reset)
            db.session.commit()
            return jsonify({"status": "error", "message": "O link de redefinição expirou. Solicite um novo."}), 400

        data = request.get_json()
        nova_senha = data.get('password', '').strip()
        confirmar = data.get('confirm', '').strip()
        
        if nova_senha != confirmar:
            return jsonify({"status": "error", "message": "As senhas não coincidem."}), 400
        if len(nova_senha) < 4:
            return jsonify({"status": "error", "message": "A senha deve ter pelo menos 4 caracteres."}), 400
            
        user = User.query.filter_by(username=reset.username).first()
        if not user:
            return jsonify({"status": "error", "message": "Erro ao redefinir a senha."}), 400

        user.password = generate_password_hash(nova_senha)
        db.session.delete(reset)
        db.session.commit()
        log_atividade(user.username, 'Senha redefinida via token')
        return jsonify({"status": "success", "message": "Senha redefinida com sucesso!"})

    except Exception as e:
        print(f"Erro ao redefinir senha: {e}")
        db.session.rollback()
        return jsonify({"status": "error", "message": "Erro interno ao redefinir a senha. Tente novamente."}), 500
