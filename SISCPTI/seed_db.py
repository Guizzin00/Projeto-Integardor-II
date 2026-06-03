import os
import sys
import json
import uuid
from datetime import datetime, timedelta, date
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

load_dotenv()

from app_instance import app, db
from models import (
    User, Project, Submission, Application, Message, 
    Notification, Rating, ActivityLog, Task, AccountVerification
)

def seed():
    print("Iniciando carga de dados de teste (Seeding)...")
    
    # 1. Limpando dados antigos
    print("Limpando tabelas existentes...")
    db.drop_all()
    db.create_all()
    
    # 2. Criando Usuários
    print("Criando usuários...")
    senha_padrao = generate_password_hash("1234")
    
    usuarios = [
        User(username="admin", password=senha_padrao, role="admin", email="admin@ceub.br", bio="Super Administrador do sistema.", ativo=True),
        User(username="coord1", password=senha_padrao, role="coordenador", email="coord1@ceub.br", bio="Coordenador de Projetos de TI do UniCEUB.", ativo=True),
        User(username="prof.ana", password=senha_padrao, role="professor", email="ana.silva@ceub.br", bio="Professora Orientadora especialista em Engenharia de Software e Desenvolvimento Web.", ativo=True),
        User(username="prof.carlos", password=senha_padrao, role="professor", email="carlos.souza@ceub.br", bio="Professor Orientador especialista em IA, Ciência de Dados e Redes.", ativo=True),
        User(username="aluno.lucas", password=senha_padrao, role="aluno", email="lucas.silva@aluno.ceub.br", bio="Estudante de Ciência da Computação, focado em frontend e mobile.", interesses="React, Flutter, UI/UX", ativo=True),
        User(username="aluno.julia", password=senha_padrao, role="aluno", email="julia.santos@aluno.ceub.br", bio="Estudante de Engenharia de Computação, focada em backend e infraestrutura.", interesses="Python, Docker, SQL", ativo=True),
        User(username="aluno.rodrigo", password=senha_padrao, role="aluno", email="rodrigo.oliveira@aluno.ceub.br", bio="Estudante de Análise e Desenvolvimento de Sistemas.", interesses="Flask, Vue.js, Node.js", ativo=True),
        User(username="lider.bruno", password=senha_padrao, role="lider", email="bruno.lima@aluno.ceub.br", bio="Estudante e Scrum Master da equipe.", interesses="Metodologias Ágeis, Django", ativo=True),
        User(username="empresa.tech", password=senha_padrao, role="empresa", email="contato@techsolutions.com.br", bio="Empresa parceira com foco em soluções de nuvem.", ativo=True),
        User(username="cliente.maria", password=senha_padrao, role="cliente", email="maria.po@cliente.com.br", bio="Product Owner de projeto parceiro.", ativo=True),
        User(username="user.inativo", password=senha_padrao, role="aluno", email="inativo@aluno.ceub.br", bio="Usuário aguardando ativação.", interesses="HTML, CSS", ativo=False)
    ]
    
    for u in usuarios:
        db.session.add(u)
    db.session.commit()
    
    # Buscar IDs gerados dos professores
    prof_ana = User.query.filter_by(username="prof.ana").first()
    prof_carlos = User.query.filter_by(username="prof.carlos").first()
    
    # 3. Criando Projetos
    print("Criando projetos...")
    detalhes_padrao = [
        {"titulo": "Visão Geral", "conteudo": "Desenvolvimento de uma solução tecnológica robusta para automatizar fluxos de processos acadêmicos."},
        {"titulo": "Arquitetura", "conteudo": "A aplicação utiliza Flask no backend, banco de dados PostgreSQL e um frontend dinâmico."},
        {"titulo": "Equipe e Responsabilidades", "conteudo": "Lider: Bruno (Scrum Master). Alunos: Lucas (Frontend), Julia (Backend)."}
    ]
    
    p1 = Project(
        id=1,
        titulo="Portal de Vagas de Estágio CEUB",
        status="EM DESENVOLVIMENTO",
        professor="Ana Silva",
        professor_id=prof_ana.id,
        categoria="Web",
        descricao_curta="Plataforma para conectar alunos do UniCEUB a oportunidades de estágio e monitoria.",
        detalhes=json.dumps(detalhes_padrao),
        links=json.dumps({"github": "https://github.com/ceub/portal-vagas", "trello": "https://trello.com/b/vagas-ceub"}),
        owner_username="lider.bruno",
        tags="Flask, Python, React, PostgreSQL"
    )
    
    p2 = Project(
        id=2,
        titulo="Aplicativo de Caronas Compartilhadas Acadêmicas",
        status="EM DESENVOLVIMENTO",
        professor="Carlos Souza",
        professor_id=prof_carlos.id,
        categoria="Mobile",
        descricao_curta="Aplicativo móvel seguro para caronas entre estudantes e colaboradores do UniCEUB.",
        detalhes=json.dumps([
            {"titulo": "Sobre o App", "conteudo": "App móvel com geolocalização e verificação de e-mail institucional para segurança."},
            {"titulo": "Fases", "conteudo": "1. Protótipo, 2. Integração com Maps, 3. Lançamento Beta."}
        ]),
        links=json.dumps({"github": "https://github.com/ceub/caronas-app"}),
        owner_username="aluno.lucas",
        tags="Flutter, Firebase, Kotlin, Maps"
    )
    
    p3 = Project(
        id=3,
        titulo="Sistema de Gestão de TCC e Relatórios",
        status="CONCLUÍDO",
        professor="Ana Silva",
        professor_id=prof_ana.id,
        categoria="Web",
        descricao_curta="Ferramenta automatizada para entrega, revisão e banca avaliadora de trabalhos de conclusão de curso.",
        detalhes=json.dumps([
            {"titulo": "Status do Projeto", "conteudo": "Concluído com sucesso e homologado pela coordenação."},
            {"titulo": "Documentos", "conteudo": "Disponíveis para download na secretaria virtual."}
        ]),
        links=json.dumps({"github": "https://github.com/ceub/tcc-gestor"}),
        owner_username="aluno.julia",
        tags="Django, Python, Bootstrap, SQLite"
    )
    
    p4 = Project(
        id=4,
        titulo="Analisador de Sentimentos de Ouvidoria por IA",
        status="AGUARDANDO INÍCIO",
        professor="Carlos Souza",
        professor_id=prof_carlos.id,
        categoria="Inteligência Artificial",
        descricao_curta="Modelo de PLN para categorização automática e análise de sentimentos das manifestações recebidas pela ouvidoria do CEUB.",
        detalhes=json.dumps([
            {"titulo": "Escopo", "conteudo": "Análise preditiva utilizando técnicas de aprendizado de máquina supervisionado."}
        ]),
        links=json.dumps({}),
        owner_username="aluno.rodrigo",
        tags="Python, NLTK, Scikit-Learn, Pandas"
    )
    
    db.session.add_all([p1, p2, p3, p4])
    db.session.commit()
    
    # 4. Criando Submissões (Propostas de Projetos)
    print("Criando submissões...")
    subs = [
        Submission(nome_projeto="App de Controle de Frequência via QR Code", categoria="Mobile", descricao="Aplicativo para chamada digital nas salas de aula através da leitura de QR Code dinâmico.", proponente="Coordenação de Engenharia", email="eng.coord@ceub.br", status="EM ANÁLISE", username="admin", tags="React Native, Node.js"),
        Submission(nome_projeto="Plataforma de Mentorias Aluno-a-Aluno", categoria="Web", descricao="Rede social para veteranos oferecerem mentorias acadêmicas a calouros com gamificação.", proponente="Diretório Acadêmico", email="da@ceub.br", status="APROVADO", username="coord1", tags="Vue.js, Express, MongoDB"),
        Submission(nome_projeto="Dashboard Integrado de Recursos de TI", categoria="Web", descricao="Dashboard administrativo para visualização em tempo real do status dos laboratórios e servidores.", proponente="Departamento de Infraestrutura", email="infra@ceub.br", status="REJEITADO", username="admin", tags="Django, Grafana, Zabbix")
    ]
    db.session.add_all(subs)
    db.session.commit()
    
    # 5. Criando Tarefas (Tasks) para o Kanban
    print("Criando tarefas...")
    
    # Tarefas do Projeto 1
    t1_1 = Task(
        projeto_id=1,
        titulo="Modelagem Conceitual do Banco de Dados",
        descricao="Criar diagrama entidade-relacionamento (DER) e mapeamento lógico das tabelas no PostgreSQL.",
        status="done",
        assigned_username="aluno.julia",
        deadline=date.today() - timedelta(days=5),
        created_at=datetime.utcnow() - timedelta(days=6),
        completed_at=datetime.utcnow() - timedelta(days=5),
        checklist=json.dumps([
            {"text": "Criar DER no dbdiagram.io", "done": True},
            {"text": "Mapear chaves estrangeiras", "done": True},
            {"text": "Gerar script DDL inicial", "done": True}
        ])
    )
    
    t1_2 = Task(
        projeto_id=1,
        titulo="Desenvolvimento do Fluxo de Cadastro e Login",
        descricao="Codificar rotas de autenticação, hashing de senhas e envio de e-mail de ativação.",
        status="doing",
        assigned_username="lider.bruno",
        deadline=date.today() + timedelta(days=2),
        created_at=datetime.utcnow() - timedelta(days=2),
        checklist=json.dumps([
            {"text": "Criar tela de Cadastro em HTML/CSS", "done": True},
            {"text": "Configurar envio de e-mail com SMTP", "done": True},
            {"text": "Desenvolver página de redefinição de senha", "done": False}
        ])
    )
    
    t1_3 = Task(
        projeto_id=1,
        titulo="Criar Interface Responsiva do Workspace",
        descricao="Construir sidebar colapsável, chat lateral e aba de métricas com suporte mobile.",
        status="doing",
        assigned_username="aluno.lucas",
        deadline=date.today() + timedelta(days=1),
        created_at=datetime.utcnow() - timedelta(days=3),
        checklist=json.dumps([
            {"text": "Ajustar sidebars no mobile", "done": True},
            {"text": "Integrar Chart.js para o gráfico de Gantt", "done": False}
        ])
    )
    
    t1_4 = Task(
        projeto_id=1,
        titulo="Configurar deploy contínuo no Vercel",
        descricao="Configurar arquivo vercel.json e pipelines de integração com GitHub.",
        status="todo",
        assigned_username="aluno.rodrigo",
        deadline=date.today() + timedelta(days=7),
        created_at=datetime.utcnow() - timedelta(days=1),
        checklist=json.dumps([
            {"text": "Criar arquivo vercel.json", "done": False},
            {"text": "Vincular variáveis de ambiente no dashboard do Vercel", "done": False}
        ])
    )
    
    # Tarefas do Projeto 2
    t2_1 = Task(
        projeto_id=2,
        titulo="Configuração Inicial do Flutter",
        descricao="Iniciar repositório, configurar SDK do Flutter e carregar pacotes iniciais.",
        status="done",
        assigned_username="aluno.lucas",
        deadline=date.today() - timedelta(days=3),
        created_at=datetime.utcnow() - timedelta(days=4),
        completed_at=datetime.utcnow() - timedelta(days=3),
        checklist=json.dumps([
            {"text": "Rodar flutter create", "done": True},
            {"text": "Configurar Firebase Core", "done": True}
        ])
    )
    
    t2_2 = Task(
        projeto_id=2,
        titulo="Integração com Google Maps API",
        descricao="Consumir mapas para traçar rotas de caronas e encontrar pontos de encontro.",
        status="todo",
        assigned_username="aluno.lucas",
        deadline=date.today() + timedelta(days=5),
        created_at=datetime.utcnow() - timedelta(days=1),
        checklist=json.dumps([
            {"text": "Obter chave da API do Maps", "done": False},
            {"text": "Renderizar mapa básico na tela", "done": False}
        ])
    )
    
    db.session.add_all([t1_1, t1_2, t1_3, t1_4, t2_1, t2_2])
    db.session.commit()
    
    # 6. Criando Avaliações (Ratings) para o Projeto 3 (Concluído)
    print("Criando avaliações...")
    r1 = Rating(
        projeto_id=3,
        username="aluno.julia",
        nota=5,
        nota_organizacao=5,
        nota_orientacao=5,
        nota_aprendizado=5,
        comentario="Excelente projeto! Conseguimos implementar tudo conforme o planejado e a professora Ana nos auxiliou muito em todas as etapas.",
        data_criacao=datetime.utcnow() - timedelta(days=10)
    )
    
    r2 = Rating(
        projeto_id=3,
        username="aluno.lucas",
        nota=4,
        nota_organizacao=4,
        nota_orientacao=5,
        nota_aprendizado=4,
        comentario="Ótimo projeto, aprendi muito sobre Django e modelagem de banco de dados. A orientação foi excepcional.",
        data_criacao=datetime.utcnow() - timedelta(days=9)
    )
    db.session.add_all([r1, r2])
    db.session.commit()
    
    # 7. Criando Candidaturas (Applications)
    print("Criando candidaturas...")
    apps = [
        Application(projeto_id=1, username="aluno.rodrigo", motivo="Gostaria muito de trabalhar no desenvolvimento do portal pois tenho interesse em Flask.", experiencia="Já desenvolvi pequenos projetos web usando Flask e SQLite.", status="APROVADO"),
        Application(projeto_id=2, username="aluno.julia", motivo="Tenho interesse em aprender Flutter e mobile development.", experiencia="Tenho conhecimento em Java e POO.", status="PENDENTE"),
        Application(projeto_id=4, username="aluno.lucas", motivo="Quero aprofundar meus conhecimentos em IA e Machine Learning.", experiencia="Concluí disciplinas de IA e análise estatística.", status="PENDENTE")
    ]
    db.session.add_all(apps)
    db.session.commit()
    
    # 8. Criando Mensagens de Chat (Messages)
    print("Criando mensagens de chat...")
    msgs = [
        Message(projeto_id=1, username="lider.bruno", texto="Olá pessoal! Sejam bem-vindos ao workspace do projeto. Vamos usar este chat para alinhamentos rápidos.", data_envio=datetime.utcnow() - timedelta(days=3)),
        Message(projeto_id=1, username="aluno.julia", texto="Oi Bruno! Legal. Já iniciei a modelagem do banco de dados e criei uma tarefa no Kanban.", data_envio=datetime.utcnow() - timedelta(days=2, hours=22)),
        Message(projeto_id=1, username="aluno.lucas", texto="Show! Vou começar a desenhar a interface do workspace no frontend.", data_envio=datetime.utcnow() - timedelta(days=2, hours=20)),
        Message(projeto_id=1, username="prof.ana", texto="Excelente início, equipe. Recomendo focarem primeiro nas rotas de autenticação e no banco de dados.", data_envio=datetime.utcnow() - timedelta(days=1, hours=12))
    ]
    db.session.add_all(msgs)
    db.session.commit()
    
    # 9. Criando Notificações (Notifications)
    print("Criando notificações...")
    notifs = [
        Notification(username="lider.bruno", mensagem="Sua submissão de projeto foi aprovada pelo coordenador!", lida=False, link="/projetos"),
        Notification(username="aluno.julia", mensagem="Você foi atribuído à tarefa: Modelagem Conceitual do Banco de Dados.", lida=True, link="/projeto/1/workspace"),
        Notification(username="prof.ana", mensagem="Nova candidatura recebida para o projeto: Portal de Vagas de Estágio CEUB.", lida=False, link="/projeto/1/workspace")
    ]
    db.session.add_all(notifs)
    db.session.commit()
    
    # 10. Criando Logs de Atividades (ActivityLog)
    print("Criando logs de atividades...")
    logs = [
        ActivityLog(username="coord1", acao="Aprovação de Proposta", detalhes="Proposta 'Plataforma de Mentorias Aluno-a-Aluno' foi aprovada.", data=datetime.utcnow() - timedelta(days=4)),
        ActivityLog(username="lider.bruno", acao="Movimentação de Kanban", detalhes="Tarefa 'Modelagem Conceitual do Banco de Dados' movida para CONCLUÍDO.", data=datetime.utcnow() - timedelta(days=2)),
        ActivityLog(username="aluno.julia", acao="Edição de Perfil", detalhes="Foto de perfil e interesses foram atualizados.", data=datetime.utcnow() - timedelta(hours=4))
    ]
    db.session.add_all(logs)
    db.session.commit()
    
    # 11. Criando Tokens de Verificação pendente
    print("Criando tokens de ativação pendentes...")
    verif = AccountVerification(username="user.inativo", token=str(uuid.uuid4()), expira_em=datetime.utcnow() + timedelta(days=1))
    db.session.add(verif)
    db.session.commit()
    
    print("Carga de dados de teste finalizada com sucesso! 🌱")

if __name__ == '__main__':
    with app.app_context():
        if '--force' in sys.argv or '-y' in sys.argv:
            seed()
        else:
            try:
                confirm = input("⚠️  ATENÇÃO: Esse comando apagará TODOS os dados no Supabase e carregará dados de teste. Continuar? (s/N): ").strip().lower()
                if confirm in ['s', 'sim', 'y', 'yes']:
                    seed()
                else:
                    print("Operação cancelada.")
            except (KeyboardInterrupt, EOFError):
                print("\nOperação cancelada.")
