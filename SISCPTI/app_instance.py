from flask import Flask, request, jsonify
import os
import secrets
import tempfile
from models import db

base_dir = os.path.abspath(os.path.dirname(__file__))

app = Flask(
    __name__,
    static_folder=os.path.join(base_dir, 'static')
)

IS_PRODUCTION = os.environ.get('VERCEL') == '1' or os.environ.get('FLASK_ENV') == 'production'

# Chave de sessão: obrigatória em produção; em desenvolvimento usa uma chave aleatória por execução.
_secret_key = os.environ.get('SECRET_KEY', '').strip()
if not _secret_key:
    if IS_PRODUCTION:
        raise RuntimeError("A variável de ambiente SECRET_KEY é obrigatória em produção.")
    _secret_key = secrets.token_hex(32)
    print("[AVISO] SECRET_KEY não definida: usando chave temporária (as sessões não sobrevivem a reinícios).")
app.secret_key = _secret_key

# Cookie de sessão
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = IS_PRODUCTION

# Origens autorizadas a chamar a API com credenciais (CORS_ORIGINS separadas por vírgula; APP_URL também vale).
ALLOWED_ORIGINS = {o.strip().rstrip('/') for o in os.environ.get('CORS_ORIGINS', '').split(',') if o.strip()}
if os.environ.get('APP_URL', '').strip():
    ALLOWED_ORIGINS.add(os.environ['APP_URL'].strip().rstrip('/'))
if not IS_PRODUCTION:
    ALLOWED_ORIGINS.update({'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:5000'})

try:
    from flask_cors import CORS
    CORS(app, supports_credentials=True, origins=sorted(ALLOWED_ORIGINS))
except ImportError:
    pass


@app.before_request
def bloquear_origem_cruzada():
    """Proteção CSRF: requisições que alteram dados só passam se a origem for a própria aplicação ou autorizada."""
    if request.method in ('GET', 'HEAD', 'OPTIONS'):
        return None
    origem = (request.headers.get('Origin') or '').rstrip('/')
    if not origem:
        return None  # clientes não-navegador (sem Origin) não enviam cookies de terceiros
    if origem in ALLOWED_ORIGINS or origem == request.host_url.rstrip('/'):
        return None
    return jsonify({"status": "error", "error": "Origem não autorizada."}), 403


db_url = os.environ.get('DATABASE_URL', 'sqlite:///siscpti.db')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

if db_url.startswith("postgresql://") and "sslmode" not in db_url:
    db_url += ("&" if "?" in db_url else "?") + "sslmode=require"

# No Vercel, o sistema de arquivos é apenas leitura (read-only), exceto /tmp.
if os.environ.get('VERCEL') == '1' and db_url.startswith('sqlite'):
    db_url = f"sqlite:///{os.path.join(tempfile.gettempdir(), 'siscpti.db')}"

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
if db_url.startswith("postgresql://"):
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        'pool_recycle': 300
    }

if os.environ.get('VERCEL') == '1':
    UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), 'uploads')
else:
    UPLOAD_FOLDER = os.path.join(base_dir, 'static', 'img', 'uploads')

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024  # um pouco acima do limite por arquivo (10 MB)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Configurações do Supabase
app.config['SUPABASE_URL'] = os.environ.get('SUPABASE_URL', '')
app.config['SUPABASE_ANON_KEY'] = os.environ.get('SUPABASE_ANON_KEY', '')

# Inicializa o banco de dados no app Flask
db.init_app(app)
