from werkzeug.security import generate_password_hash
import json, os
from dotenv import load_dotenv
load_dotenv()

from app_instance import app, db
from models import User, Project, Submission

# =========================
# Inicialização e Migrações do DB
# =========================
with app.app_context():
    db.create_all()

    # Migração automática de novas colunas (SQLite não suporta ALTER TABLE com IF NOT EXISTS)
    from sqlalchemy import text, inspect as sa_inspect
    inspector = sa_inspect(db.engine)
    with db.engine.connect() as conn:
        # Altera tipo da coluna password no PostgreSQL se necessário
        if db.engine.name == 'postgresql':
            password_len = 100
            try:
                for col in inspector.get_columns('user'):
                    if col['name'] == 'password':
                        password_len = getattr(col['type'], 'length', 100)
            except Exception:
                pass
            if password_len != 255:
                conn.execute(text('ALTER TABLE "user" ALTER COLUMN password TYPE VARCHAR(255)'))
                conn.commit()

        # User: email, bio, interesses
        user_cols = [c['name'] for c in inspector.get_columns('user')]
        if 'email' not in user_cols:

            conn.execute(text('ALTER TABLE "user" ADD COLUMN email VARCHAR(120)'))
        if 'bio' not in user_cols:
            conn.execute(text('ALTER TABLE "user" ADD COLUMN bio VARCHAR(300)'))
        if 'interesses' not in user_cols:
            conn.execute(text('ALTER TABLE "user" ADD COLUMN interesses VARCHAR(300)'))
            
        # Project: professor_id, tags
        proj_cols = [c['name'] for c in inspector.get_columns('project')]
        if 'professor_id' not in proj_cols:
            conn.execute(text('ALTER TABLE "project" ADD COLUMN professor_id INTEGER'))
        if 'tags' not in proj_cols:
            conn.execute(text('ALTER TABLE "project" ADD COLUMN tags VARCHAR(300)'))
            
        # Submission: tags
        sub_cols = [c['name'] for c in inspector.get_columns('submission')]
        if 'tags' not in sub_cols:
            conn.execute(text('ALTER TABLE "submission" ADD COLUMN tags VARCHAR(300)'))
            
        # Rating: nota_organizacao, nota_orientacao, nota_aprendizado
        rating_cols = [c['name'] for c in inspector.get_columns('rating')]
        if 'nota_organizacao' not in rating_cols:
            conn.execute(text('ALTER TABLE "rating" ADD COLUMN nota_organizacao INTEGER'))
        if 'nota_orientacao' not in rating_cols:
            conn.execute(text('ALTER TABLE "rating" ADD COLUMN nota_orientacao INTEGER'))
        if 'nota_aprendizado' not in rating_cols:
            conn.execute(text('ALTER TABLE "rating" ADD COLUMN nota_aprendizado INTEGER'))
            
        # Task: deadline, checklist, created_at, completed_at
        task_cols = [c['name'] for c in inspector.get_columns('task')]
        if 'deadline' not in task_cols:
            conn.execute(text('ALTER TABLE "task" ADD COLUMN deadline DATE'))
        if 'checklist' not in task_cols:
            conn.execute(text('ALTER TABLE "task" ADD COLUMN checklist TEXT'))
        if 'created_at' not in task_cols:
            conn.execute(text('ALTER TABLE "task" ADD COLUMN created_at DATETIME'))
        if 'completed_at' not in task_cols:
            conn.execute(text('ALTER TABLE "task" ADD COLUMN completed_at DATETIME'))
            
        conn.commit()
    
    # Carga de dados iniciais se o DB estiver vazio
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
# Importar rotas modularizadas
# =========================
# As importações são feitas no final para evitar problemas de importações circulares
import routes_core
import routes_auth
import routes_project
import routes_admin

if __name__ == '__main__':
    from app_instance import socketio
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)
