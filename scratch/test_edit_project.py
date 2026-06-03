import os
import sys

# Add the SISCPTI folder to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../SISCPTI')))

from app import app, db
from models import Project

def test_permissions():
    print("Running edit project route permission test...")
    with app.test_client() as client:
        # 1. Access without login
        res = client.get('/projeto/1/editar')
        print(f"DEBUG: status={res.status_code}, headers={dict(res.headers)}")
        assert res.status_code == 302
        assert 'login' in res.headers['Location']
        print("[OK] Redirection to login when not logged in works.")

        # 2. Access with non-owner and non-admin
        with client.session_transaction() as sess:
            sess['logged_in'] = True
            sess['user'] = 'gabriel.silva'
            sess['role'] = 'user'
        
        res = client.get('/projeto/1/editar')
        assert res.status_code == 302
        assert 'perfil' in res.headers['Location']
        print("[OK] Access denied for non-owner/non-admin works.")

        # 3. Access as owner (google_brasil)
        with client.session_transaction() as sess:
            sess['logged_in'] = True
            sess['user'] = 'google_brasil'
            sess['role'] = 'user'
            
        res = client.get('/projeto/1/editar')
        assert res.status_code == 200
        assert b"Editar Projeto" in res.data
        print("[OK] Owner access allowed and page rendered successfully.")

        # 4. POST edit as owner
        res_post = client.post('/projeto/1/editar', data={
            'titulo': 'Portal de Monitoramento de Trafego do UNICEUB - Editado',
            'categoria': 'Web',
            'status': 'EM EXECUCAO',
            'professor': 'Prof. Ana Carolina',
            'descricao_curta': 'Plataforma web integrada para analise de circulacao de pessoas no campus do CEUB em tempo real.',
            'detalhes': 'Paragrafo 1\nParagrafo 2\nParagrafo 3',
            'link_nome[]': ['GitHub', 'Figma'],
            'link_url[]': ['https://github.com/ceub/trafego-monitor', 'https://figma.com/design/saude-ceub']
        })
        assert res_post.status_code == 302
        assert 'perfil' in res_post.headers['Location']
        
        # Verify the database updated
        with app.app_context():
            p = Project.query.get(1)
            assert p.titulo == 'Portal de Monitoramento de Trafego do UNICEUB - Editado'
            assert len(p.to_dict()['detalhes']) == 3
            assert p.to_dict()['detalhes'][1] == 'Paragrafo 2'
            assert p.to_dict()['links']['GitHub'] == 'https://github.com/ceub/trafego-monitor'
            assert p.to_dict()['links']['Figma'] == 'https://figma.com/design/saude-ceub'
        print("[OK] Project details and links successfully edited in database by owner.")

        # Reset title
        with app.app_context():
            p = Project.query.get(1)
            p.titulo = 'Portal de Monitoramento de Trafego do UNICEUB'
            db.session.commit()

        # 5. Access as admin
        with client.session_transaction() as sess:
            sess['logged_in'] = True
            sess['user'] = 'admin'
            sess['role'] = 'admin'
            
        res = client.get('/projeto/1/editar')
        assert res.status_code == 200
        assert b"Editar Projeto" in res.data
        print("[OK] Admin access allowed and page rendered successfully.")

        # 6. POST edit as admin
        res_post_admin = client.post('/projeto/1/editar', data={
            'titulo': 'Portal de Monitoramento de Trafego do UNICEUB - Editado por Admin',
            'categoria': 'Web',
            'status': 'EM EXECUCAO',
            'professor': 'Prof. Ana Carolina',
            'descricao_curta': 'Plataforma web integrada para analise de circulacao de pessoas no campus do CEUB em tempo real.',
            'detalhes': 'Paragrafo Admin 1\nParagrafo Admin 2',
            'link_nome[]': ['Jira'],
            'link_url[]': ['https://jira.com/project']
        })
        assert res_post_admin.status_code == 302
        assert 'admin' in res_post_admin.headers['Location']
        
        # Verify the database updated
        with app.app_context():
            p = Project.query.get(1)
            assert p.titulo == 'Portal de Monitoramento de Trafego do UNICEUB - Editado por Admin'
            assert len(p.to_dict()['detalhes']) == 2
            assert p.to_dict()['links']['Jira'] == 'https://jira.com/project'
        print("[OK] Project details and links successfully edited in database by admin.")

        # Reset title
        with app.app_context():
            p = Project.query.get(1)
            p.titulo = 'Portal de Monitoramento de Trafego do UNICEUB'
            db.session.commit()

    print("\nALL TESTS PASSED SUCCESSFULLY! The editing feature is fully functional now.")

if __name__ == '__main__':
    test_permissions()
