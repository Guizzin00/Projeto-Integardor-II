# -------------------------------------------------------------------
# SisCPTI - Sistema de Gestão do Caderno de Projetos de TI
# Copyright (c) 2026 Equipe SisCPTI (CEUB). Todos os direitos reservados.
# Autores: Arthur Grangeiro, Davi Souza, Guilherme Gouveia,
#          Guilherme Oliveira Ribeiro Soares
# Software proprietário. Uso, cópia ou distribuição proibidos sem
# autorização dos autores. Ver arquivo LICENSE.
# -------------------------------------------------------------------

from werkzeug.security import generate_password_hash
import json, os
from dotenv import load_dotenv
load_dotenv()

__project__ = "SisCPTI"
__copyright__ = "Copyright (c) 2026 Equipe SisCPTI (CEUB). Todos os direitos reservados."
__authors__ = [
    "Arthur Grangeiro",
    "Davi Souza",
    "Guilherme Gouveia",
    "Guilherme Oliveira Ribeiro Soares",
]
__license__ = "Proprietary"

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
                        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS matricula VARCHAR(30)',
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
                        "UPDATE \"user\" SET data_cadastro = CURRENT_TIMESTAMP WHERE data_cadastro IS NULL",
                        "UPDATE \"user\" SET email = LOWER(username) || '@ceub.br' WHERE email IS NULL OR TRIM(email) = ''",
                        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN DEFAULT TRUE',
                        'ALTER TABLE "project" ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMP',
                        'ALTER TABLE "submission" ADD COLUMN IF NOT EXISTS projeto_id INTEGER',
                        "UPDATE \"project\" SET status = 'EM EXECUÇÃO' WHERE status = 'EM DESENVOLVIMENTO'",
                        "UPDATE \"project\" SET status = 'CONCLUÍDO' WHERE status = 'EXECUTADO'",
                        'ALTER TABLE "application" ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL',
                        'UPDATE "application" SET user_id = (SELECT u.id FROM "user" u WHERE u.username = "application".username) WHERE user_id IS NULL AND username IS NOT NULL',
                        'ALTER TABLE "message" ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL',
                        'UPDATE "message" SET user_id = (SELECT u.id FROM "user" u WHERE u.username = "message".username) WHERE user_id IS NULL AND username IS NOT NULL',
                        'ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL',
                        'UPDATE "notification" SET user_id = (SELECT u.id FROM "user" u WHERE u.username = "notification".username) WHERE user_id IS NULL AND username IS NOT NULL',
                        'ALTER TABLE "rating" ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL',
                        'UPDATE "rating" SET user_id = (SELECT u.id FROM "user" u WHERE u.username = "rating".username) WHERE user_id IS NULL AND username IS NOT NULL',
                        'ALTER TABLE "submission" ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL',
                        'UPDATE "submission" SET user_id = (SELECT u.id FROM "user" u WHERE u.username = "submission".username) WHERE user_id IS NULL AND username IS NOT NULL',
                        'ALTER TABLE "task" ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL',
                        'UPDATE "task" SET assigned_user_id = (SELECT u.id FROM "user" u WHERE u.username = "task".assigned_username) WHERE assigned_user_id IS NULL AND assigned_username IS NOT NULL',
                        'ALTER TABLE "project" ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL',
                        'UPDATE "project" SET owner_id = (SELECT u.id FROM "user" u WHERE u.username = "project".owner_username) WHERE owner_id IS NULL AND owner_username IS NOT NULL'
                    ]
                    pg_statements.append('CREATE UNIQUE INDEX IF NOT EXISTS uq_application_projeto_username ON "application" (projeto_id, username)')
                    for stmt in pg_statements:
                        try:
                            conn.execute(text(stmt))
                            conn.commit()
                        except Exception as stmt_err:
                            # No PostgreSQL um erro deixa a transação 'abortada': sem rollback, todos os comandos seguintes falham
                            conn.rollback()
                            print(f"[DB MIGRATION PG NOTICE] '{stmt}': {stmt_err}")
                else:
                    inspector = sa_inspect(db.engine)
                    user_cols = [c['name'] for c in inspector.get_columns('user')]
                    if 'matricula' not in user_cols:
                        conn.execute(text('ALTER TABLE "user" ADD COLUMN matricula VARCHAR(30)'))
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

                    if 'email_verificado' not in user_cols:
                        conn.execute(text('ALTER TABLE "user" ADD COLUMN email_verificado BOOLEAN DEFAULT 1'))

                    conn.execute(text("UPDATE \"user\" SET email = LOWER(username) || '@ceub.br' WHERE email IS NULL OR TRIM(email) = ''"))

                    proj_cols = [c['name'] for c in inspector.get_columns('project')]
                    if 'professor_id' not in proj_cols:
                        conn.execute(text('ALTER TABLE "project" ADD COLUMN professor_id INTEGER'))
                    if 'tags' not in proj_cols:
                        conn.execute(text('ALTER TABLE "project" ADD COLUMN tags VARCHAR(300)'))
                    if 'concluido_em' not in proj_cols:
                        conn.execute(text('ALTER TABLE "project" ADD COLUMN concluido_em DATETIME'))
                    conn.execute(text("UPDATE \"project\" SET status = 'EM EXECUÇÃO' WHERE status = 'EM DESENVOLVIMENTO'"))
                    conn.execute(text("UPDATE \"project\" SET status = 'CONCLUÍDO' WHERE status = 'EXECUTADO'"))

                    sub_cols = [c['name'] for c in inspector.get_columns('submission')]
                    if 'tags' not in sub_cols:
                        conn.execute(text('ALTER TABLE "submission" ADD COLUMN tags VARCHAR(300)'))
                    if 'projeto_id' not in sub_cols:
                        conn.execute(text('ALTER TABLE "submission" ADD COLUMN projeto_id INTEGER'))

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
                    # Vínculos por id (#52): cria as colunas e preenche a partir do nome de usuário
                    _cols = [c['name'] for c in inspector.get_columns('application')]
                    if 'user_id' not in _cols:
                        conn.execute(text('ALTER TABLE "application" ADD COLUMN user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL'))
                    conn.execute(text('UPDATE "application" SET user_id = (SELECT u.id FROM "user" u WHERE u.username = "application".username) WHERE user_id IS NULL AND username IS NOT NULL'))
                    conn.commit()
                    _cols = [c['name'] for c in inspector.get_columns('message')]
                    if 'user_id' not in _cols:
                        conn.execute(text('ALTER TABLE "message" ADD COLUMN user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL'))
                    conn.execute(text('UPDATE "message" SET user_id = (SELECT u.id FROM "user" u WHERE u.username = "message".username) WHERE user_id IS NULL AND username IS NOT NULL'))
                    conn.commit()
                    _cols = [c['name'] for c in inspector.get_columns('notification')]
                    if 'user_id' not in _cols:
                        conn.execute(text('ALTER TABLE "notification" ADD COLUMN user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL'))
                    conn.execute(text('UPDATE "notification" SET user_id = (SELECT u.id FROM "user" u WHERE u.username = "notification".username) WHERE user_id IS NULL AND username IS NOT NULL'))
                    conn.commit()
                    _cols = [c['name'] for c in inspector.get_columns('rating')]
                    if 'user_id' not in _cols:
                        conn.execute(text('ALTER TABLE "rating" ADD COLUMN user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL'))
                    conn.execute(text('UPDATE "rating" SET user_id = (SELECT u.id FROM "user" u WHERE u.username = "rating".username) WHERE user_id IS NULL AND username IS NOT NULL'))
                    conn.commit()
                    _cols = [c['name'] for c in inspector.get_columns('submission')]
                    if 'user_id' not in _cols:
                        conn.execute(text('ALTER TABLE "submission" ADD COLUMN user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL'))
                    conn.execute(text('UPDATE "submission" SET user_id = (SELECT u.id FROM "user" u WHERE u.username = "submission".username) WHERE user_id IS NULL AND username IS NOT NULL'))
                    conn.commit()
                    _cols = [c['name'] for c in inspector.get_columns('task')]
                    if 'assigned_user_id' not in _cols:
                        conn.execute(text('ALTER TABLE "task" ADD COLUMN assigned_user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL'))
                    conn.execute(text('UPDATE "task" SET assigned_user_id = (SELECT u.id FROM "user" u WHERE u.username = "task".assigned_username) WHERE assigned_user_id IS NULL AND assigned_username IS NOT NULL'))
                    conn.commit()
                    _cols = [c['name'] for c in inspector.get_columns('project')]
                    if 'owner_id' not in _cols:
                        conn.execute(text('ALTER TABLE "project" ADD COLUMN owner_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL'))
                    conn.execute(text('UPDATE "project" SET owner_id = (SELECT u.id FROM "user" u WHERE u.username = "project".owner_username) WHERE owner_id IS NULL AND owner_username IS NOT NULL'))
                    conn.commit()
                    try:
                        conn.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS uq_application_projeto_username ON "application" (projeto_id, username)'))
                    except Exception as idx_err:
                        print(f"[DB MIGRATION NOTICE] índice único de candidatura: {idx_err}")
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
                        default_email = u.get('email') or f"{u['username'].lower()}@ceub.br"
                        user = User(username=u['username'], email=default_email, password=hashed_pw, role=u.get('role', 'user'))
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
                    if not u.email or not u.email.strip():
                        u.email = f"{u.username.lower()}@ceub.br"
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
