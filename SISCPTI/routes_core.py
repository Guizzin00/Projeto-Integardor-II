from flask import jsonify, send_from_directory, abort, session
import os
from app_instance import app, base_dir

dist_dir = os.path.join(base_dir, 'dist')

# =========================
# Rotas de Assets Compilados (React)
# =========================
@app.route('/assets/<path:path>')
def serve_react_assets(path):
    assets_dir = os.path.join(dist_dir, 'assets')
    full_path = os.path.join(assets_dir, path)
    if os.path.exists(full_path):
        return send_from_directory(assets_dir, path)
    
    abort(404)

# =========================
# Rotas de Health e Informações
# =========================
@app.route('/favicon.ico')
def favicon():
    icon_path = os.path.join(base_dir, 'static', 'logoCEUB.png')
    if os.path.exists(icon_path):
        return send_from_directory(os.path.join(base_dir, 'static'), 'logoCEUB.png', mimetype='image/png')
    return ('', 204)

@app.route('/api/health')
def health():
    try:
        from sqlalchemy import text
        from app_instance import db
        db.session.execute(text('SELECT 1'))
        ok = True
    except Exception:
        import traceback
        traceback.print_exc()
        ok = False

    return jsonify({
        "status": "online" if ok else "degraded",
        "message": "SisCPTI API operational"
    }), (200 if ok else 503)

@app.route('/api/migrate-db', methods=['POST'])
def api_migrate_db():
    if session.get('role') != 'admin':
        return jsonify({"status": "error", "message": "Acesso restrito a administradores."}), 403
    try:
        from app import run_db_migrations
        run_db_migrations(force=True)
        return jsonify({
            "status": "success",
            "message": "Migrações do banco de dados executadas com sucesso!"
        })
    except Exception:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": "Erro ao executar migrações. Consulte os logs do servidor."}), 500


# =========================
# Rota Principal e SPA Fallback (React)
# =========================
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    # Nunca intercepta rotas que comecem com api ou static
    if path.startswith('api') or path.startswith('static'):
        abort(404)
        
    # Se o arquivo existir dentro de dist (ex: favicon, manifesto), serve direto
    target = os.path.join(dist_dir, path)
    if path != "" and os.path.exists(target):
        return send_from_directory(dist_dir, path)
        
    # Para qualquer rota SPA (/projetos, /sobre, /login, etc.), serve o index.html compilado do React sem cache
    if os.path.exists(os.path.join(dist_dir, 'index.html')):
        resp = send_from_directory(dist_dir, 'index.html')
        resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        resp.headers['Pragma'] = 'no-cache'
        resp.headers['Expires'] = '0'
        return resp
        
    return jsonify({"status": "error", "message": "Frontend build não encontrado"}), 404

# =========================
# Handlers de Erro JSON
# =========================
@app.errorhandler(404)
def page_not_found(e):
    return jsonify({"status": "error", "message": "Endpoint não encontrado"}), 404

@app.errorhandler(403)
def forbidden(e):
    return jsonify({"status": "error", "message": "Acesso negado"}), 403

@app.errorhandler(500)
def internal_server_error(e):
    import traceback
    traceback.print_exc()
    original_err = getattr(e, 'original_exception', e)
    print(f"[ERROR 500 HANDLER]: {original_err}")
    return jsonify({"status": "error", "message": "Erro interno do servidor"}), 500

from utils import UploadInvalido

@app.errorhandler(UploadInvalido)
def upload_invalido(e):
    return jsonify({"status": "error", "message": str(e)}), 400

@app.errorhandler(413)
def arquivo_grande(e):
    return jsonify({"status": "error", "message": "Arquivo muito grande. O limite é de 10 MB."}), 413
