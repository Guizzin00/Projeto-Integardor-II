from flask import render_template, request, redirect, url_for, flash, session, abort
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import uuid

from app_instance import app
from models import db, User, PasswordReset
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

        novo_usuario = User(username=username, email=email, password=generate_password_hash(password), role="user")
        db.session.add(novo_usuario)
        db.session.commit()

        flash("✅ Cadastro realizado com sucesso! Faça login para continuar.", "success")
        return redirect(url_for('login'))

    return render_template('cadastro.html')

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
            <h2>Redefinição de Senha – SisCPTI</h2>
            <p>Clique no link abaixo para redefinir sua senha. O link expira em 1 hora.</p>
            <p><a href="{link}">{link}</a></p>
            <p>Se você não solicitou isso, ignore este e-mail.</p>
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
