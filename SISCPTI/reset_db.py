# -------------------------------------------------------------------
# SisCPTI - Sistema de Gestão do Caderno de Projetos de TI
# Copyright (c) 2026 Equipe SisCPTI (CEUB). Todos os direitos reservados.
# Autores: Arthur Grangeiro, Davi Souza, Guilherme Gouveia,
#          Guilherme Oliveira Ribeiro Soares
# Software proprietário. Uso, cópia ou distribuição proibidos sem
# autorização dos autores. Ver arquivo LICENSE.
# -------------------------------------------------------------------

import os
import sys
from dotenv import load_dotenv
load_dotenv()

from app_instance import app, db
# Ensure all models are imported so SQLalchemy knows they exist when dropping/creating
from models import User, Project, Submission, Rating, Task, PasswordReset, AccountVerification, Notification

def reset():
    print("Dropping all tables...")
    db.drop_all()
    print("Recreating all tables...")
    db.create_all()
    print("Database cleaned and reset successfully! Next time you run the app, it will re-seed the default data.")

if __name__ == '__main__':
    with app.app_context():
        # Check if run with --force or if running in non-interactive environment
        if '--force' in sys.argv or '-y' in sys.argv:
            reset()
        else:
            try:
                confirm = input("⚠️  ATENÇÃO: Isso irá apagar todas as tabelas e dados do banco de dados! Confirmar? (s/N): ").strip().lower()
                if confirm in ['s', 'sim', 'y', 'yes']:
                    reset()
                else:
                    print("Operação cancelada.")
            except (KeyboardInterrupt, EOFError):
                print("\nOperação cancelada.")
