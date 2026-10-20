from werkzeug.security import generate_password_hash
import json, os
from dotenv import load_dotenv
load_dotenv()

from app_instance import app, db
from models import User, Project, Submission

# =========================
# Inicialização e Migrações do DB
# =========================
_db_migrated = False

def run_db_migrations(force=False):
    global _db_migrated
    if _db_migrated and not force:
        return
    _db_migrated = True

    with app.app_context():
        try:
            # 1. Criação de tabelas se não existirem
            db.create_all()

            # 2. Migração automática de novas colunas
            from sqlalchemy import text, inspect as sa_inspect
            with db.engine.connect() as conn:
                if db.engine.name == 'postgresql':
                    # No PostgreSQL, ALTER TABLE ... ADD COLUMN IF NOT EXISTS é atômico, não bloqueia e leva < 5ms
                    pg_statements = [
                        'ALTER TABLE "user" ALTER COLUMN password TYPE VARCHAR(255)',
                        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email VARCHAR(120)',
                        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email_secundario VARCHAR(120)',
                        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS bio VARCHAR(300)',
                        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS interesses VARCHAR(300) DEFAULT \'\'',
                        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE',
                        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS status_aprovacao VARCHAR(20) DEFAULT \'APROVADO\'',
                        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                        'ALTER TABLE "project" ADD COLUMN IF NOT EXISTS professor_id INTEGER',
                        'ALTER TABLE "project" ADD COLUMN IF NOT EXISTS tags VARCHAR(300) DEFAULT \'\'',
                        'ALTER TABLE "submission" ADD COLUMN IF NOT EXISTS tags VARCHAR(300) DEFAULT \'\'',
                        'ALTER TABLE "rating" ADD COLUMN IF NOT EXISTS nota_organizacao INTEGER DEFAULT 5',
                        'ALTER TABLE "rating" ADD COLUMN IF NOT EXISTS nota_orientacao INTEGER DEFAULT 5',
                        'ALTER TABLE "rating" ADD COLUMN IF NOT EXISTS nota_aprendizado INTEGER DEFAULT 5',
                        'ALTER TABLE "task" ADD COLUMN IF NOT EXISTS deadline DATE',
                        'ALTER TABLE "task" ADD COLUMN IF NOT EXISTS checklist TEXT',
                        'ALTER TABLE "task" ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                        'ALTER TABLE "task" ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP',
                        "UPDATE \"user\" SET status_aprovacao = 'APROVADO' WHERE status_aprovacao IS NULL",
                        "UPDATE \"user\" SET data_cadastro = CURRENT_TIMESTAMP WHERE data_cadastro IS NULL"
                    ]
                    for stmt in pg_statements:
                        try:
                            conn.execute(text(stmt))
                            conn.commit()
                        except Exception as stmt_err:
                            print(f"[DB MIGRATION PG NOTICE] '{stmt}': {stmt_err}")
                else:
                    inspector = sa_inspect(db.engine)
                    user_cols = [c['name'] for c in inspector.get_columns('user')]
                    if 'email' not in user_cols:
                        conn.execute(text('ALTER TABLE "user" ADD COLUMN email VARCHAR(120)'))
                    if 'email_secundario' not in user_cols:
                        conn.execute(text('ALTER TABLE "user" ADD COLUMN email_secundario VARCHAR(120)'))
                    if 'bio' not in user_cols:
                        conn.execute(text('ALTER TABLE "user" ADD COLUMN bio VARCHAR(300)'))
                    if 'interesses' not in user_cols:
                        conn.execute(text('ALTER TABLE "user" ADD COLUMN interesses VARCHAR(300)'))
                    if 'ativo' not in user_cols:
                        conn.execute(text('ALTER TABLE "user" ADD COLUMN ativo BOOLEAN DEFAULT 1'))
                    if 'status_aprovacao' not in user_cols:
                        conn.execute(text("ALTER TABLE \"user\" ADD COLUMN status_aprovacao VARCHAR(20) DEFAULT 'APROVADO'"))
                    if 'data_cadastro' not in user_cols:
                        conn.execute(text('ALTER TABLE "user" ADD COLUMN data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP'))

                    proj_cols = [c['name'] for c in inspector.get_columns('project')]
                    if 'professor_id' not in proj_cols:
                        conn.execute(text('ALTER TABLE "project" ADD COLUMN professor_id INTEGER'))
                    if 'tags' not in proj_cols:
                        conn.execute(text('ALTER TABLE "project" ADD COLUMN tags VARCHAR(300)'))

                    sub_cols = [c['name'] for c in inspector.get_columns('submission')]
                    if 'tags' not in sub_cols:
                        conn.execute(text('ALTER TABLE "submission" ADD COLUMN tags VARCHAR(300)'))

                    rating_cols = [c['name'] for c in inspector.get_columns('rating')]
                    if 'nota_organizacao' not in rating_cols:
                        conn.execute(text('ALTER TABLE "rating" ADD COLUMN nota_organizacao INTEGER'))
                    if 'nota_orientacao' not in rating_cols:
                        conn.execute(text('ALTER TABLE "rating" ADD COLUMN nota_orientacao INTEGER'))
                    if 'nota_aprendizado' not in rating_cols:
                        conn.execute(text('ALTER TABLE "rating" ADD COLUMN nota_aprendizado INTEGER'))

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

            print("[DB MIGRATION] Migração do banco concluída com sucesso.")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[DB MIGRATION ERROR]: {e}")

# Executa migração na inicialização local
if os.environ.get('VERCEL') != '1':
    run_db_migrations()
    # Carga de dados iniciais locais se o DB estiver vazio
    with app.app_context():
        try:
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
        except Exception as e:
            print(f"Erro ao carregar dados iniciais locais: {e}")

# No Vercel (serverless), executa migrações de forma segura na primeira requisição recebida
@app.before_request
def ensure_db_migrated():
    global _db_migrated
    if not _db_migrated:
        run_db_migrations()

# =========================
# Importar rotas modularizadas
# =========================
# As importações são feitas no final para evitar problemas de importações circulares
import routes_core
import routes_auth
import routes_project
import routes_admin

if __name__ == '__main__':
    app.run(debug=True)
