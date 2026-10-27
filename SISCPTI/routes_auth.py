# -------------------------------------------------------------------
# SisCPTI - Sistema de Gestão do Caderno de Projetos de TI
# Copyright (c) 2026 Equipe SisCPTI (CEUB). Todos os direitos reservados.
# Autores: Arthur Grangeiro, Davi Souza, Guilherme Gouveia,
#          Guilherme Oliveira Ribeiro Soares
# Software proprietário. Uso, cópia ou distribuição proibidos sem
# autorização dos autores. Ver arquivo LICENSE.
# -------------------------------------------------------------------

from flask import request, session, jsonify, url_for, g
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
import re
import uuid

from app_instance import app, base_dir
from models import db, User, PasswordReset, AccountVerification, Notification
from utils import (PAPEIS_AUTOCADASTRO, validar_senha, ip_do_cliente, limite_excedido, registrar_tentativa,
                   limpar_tentativas, log_atividade, enviar_email, email_template_ativacao, email_template_recuperacao, email_template_espera_aprovacao, get_frontend_url)

# =========================
# Login e Cadastro (API)
# =========================
@app.route('/api/login', methods=['POST'])
def api_login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "Dados não fornecidos"}), 400

        identificador = (data.get('user') or '').strip()
        password = data.get('password') or ''

        ip = ip_do_cliente()
        if limite_excedido('login_ip', ip, 20, 600) or limite_excedido('login_user', identificador.lower(), 5, 900):
            return jsonify({"status": "error", "message": "Muitas tentativas de login. Aguarde alguns minutos e tente novamente."}), 429

        # Entrada flexível por matrícula/usuário ou por e-mail (principal ou secundário)
        usuario = User.query.filter(db.func.lower(User.username) == identificador.lower()).first()
        if not usuario:
            usuario = User.query.filter(
                db.or_(
                    db.func.lower(User.email) == identificador.lower(),
                    db.func.lower(User.email_secundario) == identificador.lower()
                )
            ).first()

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
                return jsonify({"status": "error", "message": "Conta não ativada. Verifique seu e-mail para ativar.", "needs_verification": True}), 403

            limpar_tentativas('login_user', identificador.lower())
            session.clear()
            session['logged_in'] = True
            session['user'] = usuario.username
            session['uid'] = usuario.id
            session['role'] = usuario.role
            session['pwv'] = assinatura_senha(usuario)

            log_atividade(usuario.username, 'Login realizado')
            
            return jsonify({
                "status": "success", 
                "message": "Login realizado com sucesso",
                "user": perfil_payload(usuario)
            })
        else:
            registrar_tentativa('login_ip', ip)
            registrar_tentativa('login_user', identificador.lower())
            return jsonify({"status": "error", "message": "Matrícula/e-mail ou senha incorretos"}), 401
    except Exception:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": "Erro interno ao autenticar."}), 500

@app.route('/api/cadastro', methods=['POST'])
def api_cadastro():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"status": "error", "message": "Dados não fornecidos"}), 400

    ip = ip_do_cliente()
    if limite_excedido('cadastro_ip', ip, 5, 3600):
        return jsonify({"status": "error", "message": "Muitos cadastros a partir deste endereço. Tente novamente mais tarde."}), 429
    registrar_tentativa('cadastro_ip', ip)

    username = str(data.get('username') or '').strip()
    email = str(data.get('email') or '').strip()
    password = data.get('password')
    confirm = data.get('confirm')

    if not email or not username or not password:
        return jsonify({"status": "error", "message": "Preencha todos os campos."}), 400

    if password != confirm:
        return jsonify({"status": "error", "message": "As senhas não coincidem."}), 400

    erro_senha = validar_senha(password)
    if erro_senha:
        return jsonify({"status": "error", "message": erro_senha}), 400

    if len(username) > 50:
        return jsonify({"status": "error", "message": "A matrícula/usuário deve ter no máximo 50 caracteres."}), 400

    if '@' in username:
        return jsonify({"status": "error", "message": "A matrícula/usuário não pode conter '@'. Seu e-mail também serve para entrar."}), 400

    if not email_valido(email):
        return jsonify({"status": "error", "message": "Informe um e-mail válido."}), 400

    if User.query.filter(db.func.lower(User.username) == username.lower()).first():
        return jsonify({"status": "error", "message": "Esta matrícula/nome de usuário já está em uso."}), 400

    if User.query.filter(db.func.lower(User.email) == email.lower()).first():
        return jsonify({"status": "error", "message": "Este e-mail já está associado a outra conta."}), 400

    # Se for o primeiro usuário cadastrado no banco zerado, torna admin ativo imediatamente
    eh_primeiro_usuario = User.query.first() is None
    if eh_primeiro_usuario:
        novo_usuario = User(
            username=username, 
            email=email, 
            password=generate_password_hash(password), 
            role='admin', 
            ativo=True,
            email_verificado=True,
            status_aprovacao='APROVADO'
        )
        db.session.add(novo_usuario)
        db.session.commit()
        log_atividade(username, 'Primeiro usuário registrado (promovido a Administrador)')
        return jsonify({
            "status": "success", 
            "message": "Primeira conta registrada! Você foi configurado como Administrador e já pode fazer login."
        })

    requested_role = (data.get('role') or 'aluno').strip().lower()
    role = requested_role if requested_role in PAPEIS_AUTOCADASTRO else 'aluno'

    if role in ['professor', 'empresa']:
        # Contas de Professor e Empresa passam por validação obrigatória
        novo_usuario = User(
            username=username, 
            email=email, 
            password=generate_password_hash(password), 
            role=role, 
            ativo=False,
            email_verificado=False,
            status_aprovacao='PENDENTE'
        )
        db.session.add(novo_usuario)
        db.session.commit()

        token_verif = str(uuid.uuid4())
        db.session.add(AccountVerification(username=username, token=token_verif, expira_em=datetime.utcnow() + timedelta(days=2)))
        db.session.commit()

        # Envia notificação interna para todos os Coordenadores e Admins
        try:
            staff_users = User.query.filter(User.role.in_(['admin', 'coordenador'])).all()
            role_nome = "Professor Orientador" if role == 'professor' else "Empresa Parceira"
            for staff in staff_users:
                notif = Notification(
                    user_id=staff.id,
                    username=staff.username,
                    mensagem=f"Nova solicitação de conta ({role_nome}): @{username}. Requer validação.",
                    link="/coordenador" if staff.role == 'coordenador' else "/admin?tab=aprovacoes"
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
        link_verif = base_url + f"/verificar-conta/{token_verif}"
        enviar_email(email, 'Confirme seu e-mail – SisCPTI · UniCEUB', email_template_ativacao(username, link_verif, base_url=base_url))

        return jsonify({
            "status": "success", 
            "message": f"Solicitação registrada com sucesso! Sua conta com perfil de {role.capitalize()} está em espera aguardando a validação de um coordenador ou administrador. Enviamos os detalhes e um link para confirmar seu e-mail."
        })
    else:
        # Aluno e demais perfis padrão
        novo_usuario = User(
            username=username, 
            email=email, 
            password=generate_password_hash(password), 
            role=role, 
            ativo=False,
            email_verificado=False,
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
            return jsonify({"status": "error", "message": "O link de ativação expirou. Solicite o reenvio do e-mail de confirmação.", "needs_verification": True}), 400

        user = User.query.filter_by(username=verification.username).first()
        if not user:
            return jsonify({"status": "error", "message": "Erro ao ativar: usuário não encontrado."}), 400

        ja_verificado = bool(getattr(user, 'email_verificado', False) and user.ativo)
        user.email_verificado = True
        aprovado = (getattr(user, 'status_aprovacao', 'APROVADO') or 'APROVADO') == 'APROVADO'
        if aprovado:
            user.ativo = True
        db.session.commit()
        if not ja_verificado:
            log_atividade(user.username, 'E-mail confirmado')
        if not aprovado:
            return jsonify({"status": "success", "message": "E-mail confirmado! Sua conta ainda aguarda a validação da coordenação ou administração."})
        return jsonify({"status": "success", "message": "Conta ativada com sucesso! Você já pode fazer o login."})

    except Exception as e:
        print(f"Erro ao verificar conta: {e}")
        db.session.rollback()
        return jsonify({"status": "error", "message": "Erro interno ao ativar a conta. Tente novamente."}), 500


@app.route('/api/reenviar-verificacao', methods=['POST'])
def api_reenviar_verificacao():
    data = request.get_json(silent=True) or {}
    identificador = str(data.get('user') or data.get('email') or '').strip()
    if not identificador:
        return jsonify({"status": "error", "message": "Informe sua matrícula/usuário ou e-mail cadastrado."}), 400

    ip = ip_do_cliente()
    if limite_excedido('reenviar_verif_ip', ip, 5, 900) or limite_excedido('reenviar_verif_user', identificador.lower(), 3, 900):
        return jsonify({"status": "error", "message": "Muitas solicitações de reenvio. Aguarde alguns minutos e tente novamente."}), 429
    registrar_tentativa('reenviar_verif_ip', ip)
    registrar_tentativa('reenviar_verif_user', identificador.lower())

    usuario = User.query.filter(db.func.lower(User.username) == identificador.lower()).first()
    if not usuario and '@' in identificador:
        usuario = User.query.filter(
            db.or_(
                db.func.lower(User.email) == identificador.lower(),
                db.func.lower(User.email_secundario) == identificador.lower()
            )
        ).first()

    if not usuario:
        return jsonify({"status": "error", "message": "Nenhuma conta localizada para os dados informados."}), 404

    if getattr(usuario, 'email_verificado', False) and usuario.ativo:
        return jsonify({"status": "success", "message": "Sua conta já está ativada! Você já pode fazer login."})

    if not usuario.email:
        return jsonify({"status": "error", "message": "Esta conta não possui um e-mail cadastrado para envio."}), 400

    AccountVerification.query.filter_by(username=usuario.username).delete()
    token = str(uuid.uuid4())
    expira = datetime.utcnow() + timedelta(days=1)
    db.session.add(AccountVerification(username=usuario.username, token=token, expira_em=expira))
    db.session.commit()

    base_url = get_frontend_url() or request.host_url.rstrip('/')
    link = base_url + f"/verificar-conta/{token}"
    corpo = email_template_ativacao(usuario.username, link, base_url=base_url)
    enviar_email(usuario.email, 'Ativação de Conta Institucional – SisCPTI · UniCEUB', corpo)
    log_atividade(usuario.username, 'Solicitou reenvio de e-mail de validação')

    return jsonify({
        "status": "success",
        "message": "Enviamos um novo link de validação para o seu e-mail cadastrado. Verifique também a caixa de spam."
    })


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

def assinatura_senha(user):
    """Impressão digital do hash da senha: muda quando a senha muda e invalida as outras sessões."""
    import hashlib
    return hashlib.sha256((user.password or '').encode('utf-8')).hexdigest()[:16]


@app.before_request
def validar_sessao():
    """Resolve o usuário da sessão pelo id (renomear a conta não derruba nem quebra a sessão) e
    encerra sessões abertas antes de uma troca de senha e de usuários removidos/desativados."""
    g.user = None
    g.uid = None
    if not session.get('logged_in'):
        return None
    uid = session.get('uid')
    user = db.session.get(User, uid) if uid else User.query.filter_by(username=session.get('user')).first()
    if not user or not user.ativo or session.get('pwv') != assinatura_senha(user):
        session.clear()
        return None
    session['uid'] = user.id
    session['user'] = user.username  # reflete renomeações feitas pelo administrador
    session['role'] = user.role      # e mudanças de papel
    g.user = user
    g.uid = user.id
    return None


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

def _propagar_renomeacao(antigo, novo):
    """Propaga a mudança de username para todas as tabelas que guardam o nome como texto."""
    from models import Application, Project, Message, Rating, Submission, ActivityLog, Task
    for modelo, campo in [(Application, 'username'), (Project, 'owner_username'), (Project, 'professor'),
                          (Message, 'username'), (Notification, 'username'), (Rating, 'username'),
                          (Submission, 'username'), (ActivityLog, 'username'), (Task, 'assigned_username'),
                          (PasswordReset, 'username'), (AccountVerification, 'username')]:
        modelo.query.filter(getattr(modelo, campo) == antigo).update({campo: novo}, synchronize_session=False)


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

    novo_username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip()
    email_secundario = (data.get('email_secundario') or '').strip()
    bio = (data.get('bio') or '').strip()
    interesses = normalizar_interesses(data.get('interesses'))
    nova_senha = (data.get('nova_senha') or '').strip()
    confirmar_senha = (data.get('confirmar_senha') or '').strip()

    if novo_username and novo_username != user.username:
        if len(novo_username) > 50 or '@' in novo_username:
            return jsonify({"status": "error", "message": "O nome de usuário não pode conter '@' nem ultrapassar 50 caracteres."}), 400
        if User.query.filter(db.func.lower(User.username) == novo_username.lower(), User.id != user.id).first():
            return jsonify({"status": "error", "message": "Este nome de usuário já está em uso."}), 400

    if len(interesses) > 300:
        return jsonify({"status": "error", "message": "Os interesses ultrapassam 300 caracteres. Remova alguns itens."}), 400
    if email:
        if not email_valido(email):
            return jsonify({"status": "error", "message": "E-mail principal inválido."}), 400
        if email.lower() != (user.email or '').lower():
            if User.query.filter(db.func.lower(User.email) == email.lower(), User.id != user.id).first():
                return jsonify({"status": "error", "message": "Este e-mail já está associado a outra conta."}), 400
    if email_secundario:
        if not email_valido(email_secundario):
            return jsonify({"status": "error", "message": "E-mail secundário inválido."}), 400
        if email_secundario.lower() == (email or user.email or '').lower():
            return jsonify({"status": "error", "message": "O e-mail secundário deve ser diferente do principal."}), 400

    if nova_senha:
        if nova_senha != confirmar_senha:
            return jsonify({"status": "error", "message": "As senhas não coincidem."}), 400
        erro_senha = validar_senha(nova_senha)
        if erro_senha:
            return jsonify({"status": "error", "message": erro_senha}), 400
        if check_password_hash(user.password, nova_senha):
            return jsonify({"status": "error", "message": "A nova senha não pode ser igual à senha anterior."}), 400
        user.password = generate_password_hash(nova_senha)

    if novo_username and novo_username != user.username:
        _propagar_renomeacao(user.username, novo_username)
        user.username = novo_username
        session['user'] = novo_username

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

    session['pwv'] = assinatura_senha(user)  # mantém esta sessão; as demais são encerradas
    log_atividade(user.username, 'Edição de Perfil')
    return jsonify({
        "status": "success",
        "message": "Perfil atualizado com sucesso!",
        "user": perfil_payload(user)
    })

@app.route('/api/recuperar-senha', methods=['POST'])
def api_recuperar_senha():
    data = request.get_json(silent=True) or {}
    email = str(data.get('email') or '').strip()

    ip = ip_do_cliente()
    if limite_excedido('recuperar_ip', ip, 10, 3600) or limite_excedido('recuperar_email', email.lower(), 3, 3600):
        return jsonify({"status": "error", "message": "Muitos pedidos de recuperação. Tente novamente mais tarde."}), 429
    registrar_tentativa('recuperar_ip', ip)
    registrar_tentativa('recuperar_email', email.lower())

    user = User.query.filter(
        db.or_(
            db.func.lower(User.email) == email.lower(),
            db.func.lower(User.email_secundario) == email.lower()
        )
    ).first() if email else None
    
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

        data = request.get_json(silent=True) or {}
        nova_senha = str(data.get('password') or '').strip()
        confirmar = str(data.get('confirm') or '').strip()

        if nova_senha != confirmar:
            return jsonify({"status": "error", "message": "As senhas não coincidem."}), 400
        erro_senha = validar_senha(nova_senha)
        if erro_senha:
            return jsonify({"status": "error", "message": erro_senha}), 400
            
        user = User.query.filter_by(username=reset.username).first()
        if not user:
            return jsonify({"status": "error", "message": "Erro ao redefinir a senha."}), 400

        if check_password_hash(user.password, nova_senha):
            return jsonify({"status": "error", "message": "A nova senha não pode ser igual à senha anterior."}), 400

        user.password = generate_password_hash(nova_senha)
        db.session.delete(reset)
        db.session.commit()
        log_atividade(user.username, 'Senha redefinida via token')
        return jsonify({"status": "success", "message": "Senha redefinida com sucesso!"})

    except Exception as e:
        print(f"Erro ao redefinir senha: {e}")
        db.session.rollback()
        return jsonify({"status": "error", "message": "Erro interno ao redefinir a senha. Tente novamente."}), 500
