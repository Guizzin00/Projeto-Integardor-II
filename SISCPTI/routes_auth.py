from flask import render_template, request, redirect, url_for, flash, session, abort
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import uuid

from app_instance import app
from models import db, User, PasswordReset, AccountVerification
from utils import log_atividade, enviar_email

# =========================
# Login e Cadastro
# =========================
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        user = request.form.get('user')
        password = request.form.get('password')

        usuario = User.query.filter_by(username=user).first()

        if usuario and check_password_hash(usuario.password, password):
            if not usuario.ativo:
                flash("❌ Esta conta ainda não foi ativada. Verifique seu e-mail para ativá-la!", "error")
                return redirect(url_for('login'))

            session['logged_in'] = True
            session['user'] = usuario.username
            session['role'] = usuario.role

            if usuario.role == 'admin':
                flash(f"👑 Bem-vindo, administrador {usuario.username}!", "success")
                return redirect(url_for('admin_dashboard'))
            else:
                flash(f"✅ Login realizado com sucesso, {usuario.username}!", "success")
                return redirect(url_for('index'))
        else:
            flash("❌ Usuário ou senha incorretos!", "error")
            return redirect(url_for('login'))

    return render_template('login.html')

@app.route('/cadastro', methods=['GET', 'POST'])
def cadastro():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password')
        confirm = request.form.get('confirm')

        if not email:
            flash("❌ O e-mail é obrigatório.", "error")
            return redirect(url_for('cadastro'))

        if password != confirm:
            flash("❌ As senhas não coincidem.", "error")
            return redirect(url_for('cadastro'))

        if User.query.filter_by(username=username).first():
            flash("⚠️ Este nome de usuário já está em uso.", "error")
            return redirect(url_for('cadastro'))

        if User.query.filter_by(email=email).first():
            flash("⚠️ Este e-mail já está associado a outra conta.", "error")
            return redirect(url_for('cadastro'))

        novo_usuario = User(username=username, email=email, password=generate_password_hash(password), role="user", ativo=False)
        db.session.add(novo_usuario)
        db.session.commit()

        # Gerar token de ativacao da conta
        token = str(uuid.uuid4())
        expira = datetime.utcnow() + timedelta(days=1)
        verif = AccountVerification(username=username, token=token, expira_em=expira)
        db.session.add(verif)
        db.session.commit()

        link = url_for('verificar_conta', token=token, _external=True)
        corpo = f"""
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F6F8FA; padding: 40px 20px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E1E4E8; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: left;">
            <div style="background-color: #FFFFFF; padding: 30px 20px; text-align: center; border-bottom: 1px solid #EEEEEE;">
              <img src="https://www.uniceub.br/imagens/logoCEUB2021.png" alt="UniCEUB Logo" style="height: 45px; display: inline-block; margin-bottom: 10px;">
              <h1 style="color: #7A1BB5; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">SisCPTI</h1>
              <p style="color: #666666; margin: 5px 0 0; font-size: 13px;">Caderno de Projetos de TI · UniCEUB</p>
            </div>
            <div style="padding: 40px 30px; color: #24292E; line-height: 1.6;">
              <h2 style="margin-top: 0; font-size: 20px; color: #7A1BB5; font-weight: 700;">Ativação de Conta</h2>
              <p style="font-size: 15px; color: #586069;">Olá <strong>{username}</strong>, obrigado por se cadastrar no SisCPTI do UniCEUB!</p>
              <p style="font-size: 15px; color: #586069;">Para liberar o seu acesso à plataforma de projetos e começar a interagir com sua equipe, clique no botão de ativação abaixo:</p>
              
              <div style="margin: 30px 0; text-align: center;">
                <a href="{link}" style="display: inline-block; background-color: #7A1BB5; color: #FFFFFF; font-weight: 700; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-size: 15px; box-shadow: 0 4px 6px rgba(122,27,181,0.2);">Confirmar E-mail e Ativar Conta</a>
              </div>
              
              <p style="font-size: 12px; color: #888888; border-top: 1px solid #EEEEEE; padding-top: 20px; margin-bottom: 0;">Se o botão acima não funcionar, copie e cole o link no seu navegador:<br><a href="{link}" style="color: #7A1BB5; text-decoration: none; word-break: break-all;">{link}</a></p>
            </div>
          </div>
          <div style="margin-top: 20px; font-size: 12px; color: #586069;">
            Este é um e-mail automático. Por favor, não responda.<br>
            © 2026 UniCEUB · Coordenação de Tecnologia da Informação
          </div>
        </div>
        """
        enviado = enviar_email(email, 'Ativação de Conta – SisCPTI', corpo)
        if enviado:
            flash("📧 Conta criada com sucesso! Enviamos um link de ativação para seu e-mail.", "success")
        else:
            print(f"\n--- ATIVAÇÃO DE CONTA (CONSOLE FALLBACK) ---\nUsuário: {username}\nLink: {link}\n--------------------------------------------\n")
            flash(f"⚠️ SMTP não configurado. Ative sua conta usando este link: /verificar-conta/{token}", "warning")

        return redirect(url_for('login'))

    return render_template('cadastro.html')

@app.route('/verificar-conta/<token>')
def verificar_conta(token):
    verification = AccountVerification.query.filter_by(token=token).first()
    if not verification or verification.expira_em < datetime.utcnow():
        flash("⚠️ Link de ativação inválido ou expirado.", "error")
        return redirect(url_for('login'))

    user = User.query.filter_by(username=verification.username).first()
    if user:
        user.ativo = True
        db.session.delete(verification)
        db.session.commit()
        log_atividade(user.username, 'Conta ativada por e-mail')
        flash("✅ Conta ativada com sucesso! Faça login para continuar.", "success")
    else:
        flash("⚠️ Erro ao ativar: usuário não encontrado.", "error")
    return redirect(url_for('login'))

# =========================
# Logout
# =========================
@app.route('/logout')
def logout():
    session.clear()
    flash("Você saiu do sistema.", "info")
    return redirect(url_for('index'))

# =========================
# Edição de Perfil
# =========================
@app.route('/perfil/editar', methods=['GET', 'POST'])
def perfil_editar():
    if not session.get('logged_in'):
        flash("⚠️ Você precisa estar logado.", "error")
        return redirect(url_for('login'))

    user = User.query.filter_by(username=session['user']).first()
    if not user:
        abort(404)

    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        bio = request.form.get('bio', '').strip()
        interesses = request.form.get('interesses', '').strip()
        nova_senha = request.form.get('nova_senha', '').strip()
        confirmar_senha = request.form.get('confirmar_senha', '').strip()

        user.email = email
        user.bio = bio[:300] if bio else None
        user.interesses = interesses[:300] if interesses else ''

        if nova_senha:
            if nova_senha != confirmar_senha:
                flash("⚠️ As senhas não coincidem.", "error")
                return render_template('perfil_editar.html', user=user)
            if len(nova_senha) < 4:
                flash("⚠️ A senha deve ter pelo menos 4 caracteres.", "error")
                return render_template('perfil_editar.html', user=user)
            user.password = generate_password_hash(nova_senha)

        db.session.commit()
        log_atividade(session['user'], 'Perfil atualizado')
        flash("✅ Perfil atualizado com sucesso!", "success")
        return redirect(url_for('perfil'))

    return render_template('perfil_editar.html', user=user)

# =========================
# Recuperação de Senha
# =========================
@app.route('/recuperar-senha', methods=['GET', 'POST'])
def recuperar_senha():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        user = User.query.filter_by(email=email).first()
        if user:
            # Invalida tokens anteriores
            PasswordReset.query.filter_by(username=user.username).delete()
            import uuid
            from datetime import timedelta
            token = str(uuid.uuid4())
            expira = datetime.utcnow() + timedelta(hours=1)
            reset = PasswordReset(username=user.username, token=token, expira_em=expira)
            db.session.add(reset)
            db.session.commit()
            link = url_for('redefinir_senha', token=token, _external=True)
            corpo = f"""
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F6F8FA; padding: 40px 20px; text-align: center;">
              <div style="max-width: 500px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E1E4E8; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: left;">
                <div style="background-color: #FFFFFF; padding: 30px 20px; text-align: center; border-bottom: 1px solid #EEEEEE;">
                  <img src="https://www.uniceub.br/imagens/logoCEUB2021.png" alt="UniCEUB Logo" style="height: 45px; display: inline-block; margin-bottom: 10px;">
                  <h1 style="color: #7A1BB5; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">SisCPTI</h1>
                  <p style="color: #666666; margin: 5px 0 0; font-size: 13px;">Caderno de Projetos de TI · UniCEUB</p>
                </div>
                <div style="padding: 40px 30px; color: #24292E; line-height: 1.6;">
                  <h2 style="margin-top: 0; font-size: 20px; color: #7A1BB5; font-weight: 700;">Redefinição de Senha</h2>
                  <p style="font-size: 15px; color: #586069;">Olá <strong>{user.username}</strong>,</p>
                  <p style="font-size: 15px; color: #586069;">Recebemos uma solicitação para redefinir a senha da sua conta no SisCPTI. Clique no botão abaixo para escolher uma nova senha:</p>
                  
                  <div style="margin: 30px 0; text-align: center;">
                    <a href="{link}" style="display: inline-block; background-color: #7A1BB5; color: #FFFFFF; font-weight: 700; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-size: 15px; box-shadow: 0 4px 6px rgba(122,27,181,0.2);">Criar Nova Senha</a>
                  </div>
                  
                  <p style="font-size: 13px; color: #D93025; font-weight: 500;">⚠️ Importante: Este link expira em 1 hora por motivos de segurança.</p>
                  <p style="font-size: 12px; color: #888888; border-top: 1px solid #EEEEEE; padding-top: 20px; margin-bottom: 0;">Se o botão acima não funcionar, copie e cole o link no seu navegador:<br><a href="{link}" style="color: #7A1BB5; text-decoration: none; word-break: break-all;">{link}</a></p>
                </div>
              </div>
              <div style="margin-top: 20px; font-size: 12px; color: #586069;">
                Se você não solicitou a recuperação, pode ignorar este e-mail com segurança.<br>
                © 2026 UniCEUB · Coordenação de Tecnologia da Informação
              </div>
            </div>
            """
            enviado = enviar_email(email, 'Recuperação de Senha – SisCPTI', corpo)
            if enviado:
                flash("📧 E-mail de recuperação enviado! Verifique sua caixa de entrada.", "success")
            else:
                print(f"\n--- RECUPERAÇÃO DE SENHA (CONSOLE FALLBACK) ---\nUsuário: {user.username}\nLink: {link}\n-----------------------------------------------\n")
                flash(f"⚠️ SMTP não configurado. Token de recuperação (use diretamente): /recuperar-senha/{token}", "error")
        else:
            flash("⚠️ Nenhuma conta encontrada com este e-mail.", "error")
        return redirect(url_for('recuperar_senha'))
    return render_template('recuperar_senha.html')

@app.route('/recuperar-senha/<token>', methods=['GET', 'POST'])
def redefinir_senha(token):
    reset = PasswordReset.query.filter_by(token=token).first()
    if not reset or reset.expira_em < datetime.utcnow():
        flash("⚠️ Link inválido ou expirado.", "error")
        return redirect(url_for('recuperar_senha'))

    if request.method == 'POST':
        nova_senha = request.form.get('password', '').strip()
        confirmar = request.form.get('confirm', '').strip()
        if nova_senha != confirmar:
            flash("⚠️ As senhas não coincidem.", "error")
            return render_template('redefinir_senha.html', token=token)
        if len(nova_senha) < 4:
            flash("⚠️ A senha deve ter pelo menos 4 caracteres.", "error")
            return render_template('redefinir_senha.html', token=token)
        user = User.query.filter_by(username=reset.username).first()
        if user:
            user.password = generate_password_hash(nova_senha)
            db.session.delete(reset)
            db.session.commit()
            log_atividade(user.username, 'Senha redefinida via token')
            flash("✅ Senha redefinida com sucesso! Faça login.", "success")
            return redirect(url_for('login'))
    return render_template('redefinir_senha.html', token=token)
