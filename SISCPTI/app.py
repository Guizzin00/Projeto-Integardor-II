from flask import Flask, render_template, request, redirect, url_for, flash, session, abort, jsonify, Response
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import json, os, uuid, io, csv, smtplib
from email.mime.text import MIMEText

app = Flask(__name__)
app.secret_key = "sisCPTI_secret_key"
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///siscpti.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

UPLOAD_FOLDER = os.path.join('static', 'img', 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = SQLAlchemy(app)

# =========================
# Modelos
# =========================
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')
    email = db.Column(db.String(120), nullable=True)
    bio = db.Column(db.String(300), nullable=True)

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    professor = db.Column(db.String(100), nullable=False)
    categoria = db.Column(db.String(100), nullable=False)
    descricao_curta = db.Column(db.String(500), nullable=False)
    imagem = db.Column(db.String(200), nullable=False, default='img/default.png')
    detalhes = db.Column(db.Text, nullable=False) 
    links = db.Column(db.Text, nullable=False, default='{}')
    owner_username = db.Column(db.String(50), nullable=True) 

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "status": self.status,
            "professor": self.professor,
            "categoria": self.categoria,
            "descricao_curta": self.descricao_curta,
            "imagem": self.imagem,
            "detalhes": json.loads(self.detalhes),
            "links": json.loads(self.links) if self.links else {},
            "owner_username": self.owner_username
        }

class Submission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome_projeto = db.Column(db.String(200), nullable=False)
    categoria = db.Column(db.String(100), nullable=False)
    descricao = db.Column(db.Text, nullable=False)
    proponente = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), nullable=False, default='EM ANÁLISE')
    username = db.Column(db.String(50), nullable=True)
    imagem = db.Column(db.String(200), nullable=True)

class Application(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    username = db.Column(db.String(50), nullable=False)
    motivo = db.Column(db.Text, nullable=False)
    experiencia = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), nullable=False, default='PENDENTE')
    
    projeto = db.relationship('Project', backref=db.backref('candidaturas', lazy=True))

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    username = db.Column(db.String(50), nullable=False)
    texto = db.Column(db.Text, nullable=True)
    arquivo = db.Column(db.String(200), nullable=True)
    data_envio = db.Column(db.DateTime, default=datetime.utcnow)
    
    projeto = db.relationship('Project', backref=db.backref('mensagens', lazy=True))

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    mensagem = db.Column(db.Text, nullable=False)
    lida = db.Column(db.Boolean, nullable=False, default=False)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    link = db.Column(db.String(200), nullable=True)

class Rating(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    username = db.Column(db.String(50), nullable=False)
    nota = db.Column(db.Integer, nullable=False)  # 1-5
    comentario = db.Column(db.Text, nullable=True)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    projeto = db.relationship('Project', backref=db.backref('avaliacoes', lazy=True))

class ActivityLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    acao = db.Column(db.String(100), nullable=False)
    detalhes = db.Column(db.Text, nullable=True)
    data = db.Column(db.DateTime, default=datetime.utcnow)

class PasswordReset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=False)
    expira_em = db.Column(db.DateTime, nullable=False)

# =========================
# Inicialização do DB
# =========================
with app.app_context():
    db.create_all()

    # Migração automática de novas colunas (SQLite não suporta ALTER TABLE com IF NOT EXISTS)
    from sqlalchemy import text, inspect as sa_inspect
    inspector = sa_inspect(db.engine)
    with db.engine.connect() as conn:
        # User: email, bio
        user_cols = [c['name'] for c in inspector.get_columns('user')]
        if 'email' not in user_cols:
            conn.execute(text('ALTER TABLE "user" ADD COLUMN email VARCHAR(120)'))
        if 'bio' not in user_cols:
            conn.execute(text('ALTER TABLE "user" ADD COLUMN bio VARCHAR(300)'))
        conn.commit()
    
    if not User.query.first() and os.path.exists('users.json'):
        with open('users.json', 'r', encoding='utf-8') as f:
            users = json.load(f)
            for u in users:
                hashed_pw = generate_password_hash(u['password'])
                user = User(username=u['username'], password=hashed_pw, role=u.get('role', 'user'))
                db.session.add(user)
        db.session.commit()
    else:
        # Migração automática das senhas antigas sem hash no banco local
        all_users = User.query.all()
        migrated = False
        for u in all_users:
            if not u.password.startswith('scrypt:') and not u.password.startswith('pbkdf2:'):
                u.password = generate_password_hash(u.password)
                migrated = True
        if migrated:
            db.session.commit()

    if not Project.query.first() and os.path.exists('projects_data.json'):
        with open('projects_data.json', 'r', encoding='utf-8') as f:
            projetos = json.load(f)
            for p in projetos:
                proj = Project(
                    id=p['id'],
                    titulo=p['titulo'],
                    status=p['status'],
                    professor=p['professor'],
                    categoria=p['categoria'],
                    descricao_curta=p['descricao_curta'],
                    imagem=p.get('imagem', 'img/default.png'),
                    detalhes=json.dumps(p.get('detalhes', [])),
                    links=json.dumps(p.get('links', {})),
                    owner_username="admin" 
                )
                db.session.add(proj)
        db.session.commit()

    if not Submission.query.first() and os.path.exists('submissoes.json'):
        with open('submissoes.json', 'r', encoding='utf-8') as f:
            subs = json.load(f)
            for s in subs:
                subm = Submission(
                    nome_projeto=s['nome_projeto'],
                    categoria=s['categoria'],
                    descricao=s['descricao'],
                    proponente=s['proponente'],
                    email=s['email'],
                    status=s.get('status', 'EM ANÁLISE'),
                    username=s.get('username', 'admin')
                )
                db.session.add(subm)
        db.session.commit()

# =========================
# Rotas principais
# =========================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/projetos')
def projetos():
    projetos_db = Project.query.all()
    projetos = [p.to_dict() for p in projetos_db]
    return render_template('projetos.html', projetos=projetos)

@app.route('/projeto/<int:projeto_id>')
def projeto_detalhes(projeto_id):
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        abort(404)
    projeto = projeto_db.to_dict()
    return render_template('projeto_detalhes.html', projeto=projeto)

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

@app.route('/sobre')
def sobre():
    return render_template('sobre.html')

# =========================
# Workspace e Perfil
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
    
    return render_template('perfil.html', minhas_candidaturas=minhas_candidaturas, meus_projetos=meus_projetos, minhas_submissoes=minhas_submissoes)

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
        flash(f"Candidatura de {cand.username} foi aprovada!", "success")
    elif acao == 'rejeitar':
        cand.status = 'REJEITADA'
        notif = Notification(
            username=cand.username,
            mensagem=f"⚠️ Sua candidatura para o projeto '{cand.projeto.titulo}' foi recusada.",
            link="/perfil"
        )
        db.session.add(notif)
        flash(f"Candidatura de {cand.username} foi rejeitada.", "error")
        
    db.session.commit()
    
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

@app.route('/projeto/<int:projeto_id>/workspace')
def workspace(projeto_id):
    if not session.get('logged_in'):
        flash("Acesso negado.", "error")
        return redirect(url_for('login'))
        
    projeto_db = Project.query.get(projeto_id)
    if not projeto_db:
        abort(404)
        
    username = session['user']
    is_owner = (projeto_db.owner_username == username)
    is_admin = (session.get('role') == 'admin')
    
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    if not is_owner and not is_admin and username not in membros:
        flash("Acesso negado. Você não é membro aprovado deste projeto.", "error")
        return redirect(url_for('perfil'))
        
    mensagens = Message.query.filter_by(projeto_id=projeto_id).order_by(Message.data_envio.asc()).all()
    return render_template('workspace.html', projeto=projeto_db, membros=membros, mensagens=mensagens, is_owner=is_owner)

@app.route('/projeto/<int:projeto_id>/workspace/enviar', methods=['POST'])
def enviar_mensagem(projeto_id):
    if not session.get('logged_in'):
        return redirect(url_for('login'))
        
    texto = request.form.get('texto')
    arquivo_path = None
    if 'arquivo' in request.files:
        file = request.files['arquivo']
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            unique_filename = str(uuid.uuid4())[:8] + "_" + filename
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(save_path)
            arquivo_path = "img/uploads/" + unique_filename
            
    if texto or arquivo_path:
        nova_msg = Message(
            projeto_id=projeto_id,
            username=session['user'],
            texto=texto,
            arquivo=arquivo_path
        )
        db.session.add(nova_msg)
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
    is_owner = (projeto_db.owner_username == username)
    is_admin = (session.get('role') == 'admin')
    
    equipe_cands = Application.query.filter_by(projeto_id=projeto_id, status='APROVADA').all()
    membros = [c.username for c in equipe_cands]
    
    if not is_owner and not is_admin and username not in membros:
        return jsonify({"error": "Forbidden"}), 403
        
    texto = request.form.get('texto')
    arquivo_path = None
    if 'arquivo' in request.files:
        file = request.files['arquivo']
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            unique_filename = str(uuid.uuid4())[:8] + "_" + filename
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(save_path)
            arquivo_path = "img/uploads/" + unique_filename
            
    if texto or arquivo_path:
        nova_msg = Message(
            projeto_id=projeto_id,
            username=session['user'],
            texto=texto,
            arquivo=arquivo_path
        )
        db.session.add(nova_msg)
        db.session.commit()
        
        return jsonify({
            "status": "success",
            "message": {
                "id": nova_msg.id,
                "username": nova_msg.username,
                "texto": nova_msg.texto,
                "arquivo": nova_msg.arquivo,
                "data_envio": nova_msg.data_envio.strftime('%d/%m %H:%M')
            }
        })
        
    return jsonify({"error": "Empty message"}), 400

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
        username = request.form.get('username')
        password = request.form.get('password')
        confirm = request.form.get('confirm')

        if password != confirm:
            flash("❌ As senhas não coincidem.", "error")
            return redirect(url_for('cadastro'))

        if User.query.filter_by(username=username).first():
            flash("⚠️ Este nome de usuário já está em uso.", "error")
            return redirect(url_for('cadastro'))

        novo_usuario = User(username=username, password=generate_password_hash(password), role="user")
        db.session.add(novo_usuario)
        db.session.commit()

        flash("✅ Cadastro realizado com sucesso! Faça login para continuar.", "success")
        return redirect(url_for('login'))

    return render_template('cadastro.html')

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

@app.route('/api/notificacoes')
def api_notificacoes():
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized"}), 401
    
    username = session['user']
    # Pegar apenas as notificações não lidas dos últimos dias
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
        # Validar se username mudou e se já existe
        new_username = request.form.get('username')
        if new_username != u.username and User.query.filter_by(username=new_username).first():
            flash("⚠️ Este nome de usuário já existe.", "error")
            return redirect(url_for('admin_editar_usuario', user_id=user_id))
            
        u.username = new_username
        
        plain_pw = request.form.get('password')
        # Só atualiza a senha (gerando hash) se o campo não estiver vazio ou se for uma nova senha
        if plain_pw:
            u.password = generate_password_hash(plain_pw)
            
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

@app.route('/admin/submissao/<int:sub_id>/<acao>')
def acao_submissao(sub_id, acao):
    if session.get('role') != 'admin':
        return redirect(url_for('index'))
    
    subm = Submission.query.get(sub_id)
    if subm:
        if acao == 'aprovar':
            subm.status = 'APROVADA'
            novo_proj = Project(
                titulo=subm.nome_projeto,
                status="EM EXECUÇÃO",
                professor=subm.proponente,
                categoria=subm.categoria,
                descricao_curta=subm.descricao,
                imagem=subm.imagem or "img/default.png",
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
                
            flash(f"Submissão marcada como rejeitada.", "info")
            
        db.session.commit()
        
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/candidatura/<int:cand_id>/<acao>')
def acao_candidatura(cand_id, acao):
    return redirect(url_for('dono_acao_candidatura', cand_id=cand_id, acao=acao))

@app.route('/admin/novo', methods=['GET', 'POST'])
def novo_projeto():
    if session.get('role') != 'admin':
        flash("Acesso restrito a administradores.", "error")
        return redirect(url_for('index'))

    if request.method == 'POST':
        imagem_path = "img/default.png"
        if 'imagem_capa' in request.files:
            file = request.files['imagem_capa']
            if file and file.filename != '':
                filename = secure_filename(file.filename)
                unique_filename = str(uuid.uuid4())[:8] + "_" + filename
                save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(save_path)
                imagem_path = "img/uploads/" + unique_filename

        novo = Project(
            titulo=request.form['titulo'],
            categoria=request.form['categoria'],
            status=request.form['status'],
            professor=request.form['professor'],
            descricao_curta=request.form['descricao_curta'],
            detalhes=json.dumps([request.form['detalhes']]),
            imagem=imagem_path,
            links="{}",
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
        projeto_db.detalhes = json.dumps([request.form['detalhes']])

        if 'imagem_capa' in request.files:
            file = request.files['imagem_capa']
            if file and file.filename != '':
                filename = secure_filename(file.filename)
                unique_filename = str(uuid.uuid4())[:8] + "_" + filename
                save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(save_path)
                projeto_db.imagem = "img/uploads/" + unique_filename

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
        Application.query.filter_by(projeto_id=projeto_id).delete()
        Message.query.filter_by(projeto_id=projeto_id).delete()
        db.session.delete(projeto_db)
        db.session.commit()

    flash("🗑️ Projeto excluído com sucesso!", "success")
    return redirect(url_for('admin_dashboard'))

# =========================
# Logout
# =========================
@app.route('/logout')
def logout():
    session.clear()
    flash("Você saiu do sistema.", "info")
    return redirect(url_for('index'))

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
                filename = secure_filename(file.filename)
                unique_filename = str(uuid.uuid4())[:8] + "_" + filename
                save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(save_path)
                imagem_path = "img/uploads/" + unique_filename

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
                filename = secure_filename(file.filename)
                unique_filename = str(uuid.uuid4())[:8] + "_" + filename
                save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(save_path)
                subm.imagem = "img/uploads/" + unique_filename
                
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

# =========================
# Helper: Log de Atividade
# =========================
def log_atividade(username, acao, detalhes=None):
    try:
        log = ActivityLog(username=username, acao=acao, detalhes=detalhes)
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()

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
        nova_senha = request.form.get('nova_senha', '').strip()
        confirmar_senha = request.form.get('confirmar_senha', '').strip()

        user.email = email
        user.bio = bio[:300] if bio else None

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
# Sistema de Avaliação
# =========================
@app.route('/projeto/<int:projeto_id>/avaliar', methods=['POST'])
def avaliar_projeto(projeto_id):
    if not session.get('logged_in'):
        return jsonify({'error': 'Não autenticado'}), 401

    proj = Project.query.get(projeto_id)
    if not proj:
        abort(404)

    nota = request.form.get('nota', type=int)
    comentario = request.form.get('comentario', '').strip()

    if not nota or nota < 1 or nota > 5:
        flash("⚠️ Nota inválida. Escolha entre 1 e 5 estrelas.", "error")
        return redirect(url_for('projeto_detalhes', projeto_id=projeto_id))

    # Verifica se usuário já avaliou
    ja_avaliou = Rating.query.filter_by(projeto_id=projeto_id, username=session['user']).first()
    if ja_avaliou:
        ja_avaliou.nota = nota
        ja_avaliou.comentario = comentario
        ja_avaliou.data_criacao = datetime.utcnow()
        flash("✅ Avaliação atualizada!", "success")
    else:
        rating = Rating(projeto_id=projeto_id, username=session['user'], nota=nota, comentario=comentario)
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
        'avaliacoes': [{'username': r.username, 'nota': r.nota, 'comentario': r.comentario,
                        'data': r.data_criacao.strftime('%d/%m/%Y')} for r in ratings]
    })

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
# Recuperação de Senha
# =========================
def enviar_email(destinatario, assunto, corpo):
    mail_server = os.environ.get('MAIL_SERVER', '')
    mail_user = os.environ.get('MAIL_USER', '')
    mail_pass = os.environ.get('MAIL_PASS', '')
    if not mail_server or not mail_user:
        return False
    try:
        msg = MIMEText(corpo, 'html', 'utf-8')
        msg['Subject'] = assunto
        msg['From'] = mail_user
        msg['To'] = destinatario
        with smtplib.SMTP_SSL(mail_server, 465) as srv:
            srv.login(mail_user, mail_pass)
            srv.sendmail(mail_user, [destinatario], msg.as_string())
        return True
    except Exception:
        return False

@app.route('/recuperar-senha', methods=['GET', 'POST'])
def recuperar_senha():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        user = User.query.filter_by(email=email).first()
        if user:
            # Invalida tokens anteriores
            PasswordReset.query.filter_by(username=user.username).delete()
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
                flash(f"⚠️ SMTP não configurado. Token de recuperação (use diretamente): /recuperar-senha/{token}", "error")
        else:
            flash("⚠️ Nenhuma conta encontrada com esse e-mail.", "error")
        return redirect(url_for('recuperar_senha'))
    return render_template('recuperar_senha.html')

@app.route('/recuperar-senha/<token>', methods=['GET', 'POST'])
def redefinir_senha(token):
    reset = PasswordReset.query.filter_by(token=token).first()
    if not reset or reset.expira_em < datetime.utcnow():
        flash("⚠️ Link inválido ou expirado.", "error")
        return redirect(url_for('recuperar_senha'))

    if request.method == 'POST':
        nova_senha = request.form.get('nova_senha', '').strip()
        confirmar = request.form.get('confirmar_senha', '').strip()
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

# =========================
# Handlers de Erro
# =========================
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(403)
def forbidden(e):
    return render_template('403.html'), 403

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('500.html'), 500

# =========================
# Execução
# =========================
if __name__ == '__main__':
    app.run(debug=True)
