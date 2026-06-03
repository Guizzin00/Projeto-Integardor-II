import os
import sys

# Adiciona a pasta SISCPTI ao path de importação do python
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../SISCPTI')))

from app_instance import app, db
from models import User
from werkzeug.security import generate_password_hash

with app.app_context():
    # Procura se o admin já existe
    admin_user = User.query.filter_by(username='admin').first()
    if admin_user:
        admin_user.role = 'admin'
        admin_user.password = generate_password_hash('admin123')
        db.session.commit()
        print("Usuário 'admin' já existia. Senha redefinida para 'admin123' e cargo definido como 'admin'!")
    else:
        new_admin = User(
            username='admin',
            password=generate_password_hash('admin123'),
            role='admin',
            email='admin@siscpti.com',
            bio='Administrador geral do sistema SisCPTI.'
        )
        db.session.add(new_admin)
        db.session.commit()
        print("Usuário 'admin' criado com sucesso com a senha 'admin123'!")
