import os
import sys
import json
from datetime import datetime, timedelta

# Adiciona a pasta SISCPTI ao path de importação
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../SISCPTI')))

from app_instance import app, db
from models import User, Project, Submission, Application, Message, Notification, Rating, ActivityLog, PasswordReset
from werkzeug.security import generate_password_hash

print("Iniciando a carga de dados de teste...")

with app.app_context():
    # Limpar banco de dados existente
    print("Limpando banco de dados anterior...")
    db.drop_all()
    db.create_all()

    # ==========================================
    # 1. CRIANDO USUÁRIOS
    # ==========================================
    print("Cadastrando usuários de teste...")
    
    # Senha padrão para todos os testes: 'teste123'
    senha_hash = generate_password_hash('teste123')
    
    usuarios_dados = [
        # Administrador
        {"username": "admin", "password": generate_password_hash("admin123"), "role": "admin", "email": "admin@ceub.br", "bio": "Administrador geral da plataforma SisCPTI."},
        
        # Alunos
        {"username": "gabriel.silva", "password": senha_hash, "role": "user", "email": "gabriel.silva@aluno.urbe.br", "bio": "Aluno de Ciência da Computação (5º semestre). Focado em desenvolvimento frontend e UI/UX."},
        {"username": "julia.souza", "password": senha_hash, "role": "user", "email": "julia.souza@aluno.urbe.br", "bio": "Aluna de Engenharia de Software (6º semestre). Interesses em Backend (Python/Django) e APIs."},
        {"username": "lucas.nunes", "password": senha_hash, "role": "user", "email": "lucas.nunes@aluno.urbe.br", "bio": "Estudante de Análise e Desenvolvimento de Sistemas. Apaixonado por Mobile Flutter e React Native."},
        {"username": "mariana.costa", "password": senha_hash, "role": "user", "email": "mariana.costa@aluno.urbe.br", "bio": "Aluna de Computação. Focada em Ciência de Dados, IA e Machine Learning."},

        # Professores
        {"username": "prof.flavio", "password": senha_hash, "role": "user", "email": "flavio.souza@ceub.br", "bio": "Professor e Coordenador de Projetos de TI. Orientador em IoT, Computação Embarcada e Redes."},
        {"username": "prof.ana", "password": senha_hash, "role": "user", "email": "ana.carolina@ceub.br", "bio": "Professora orientadora de Engenharia de Software. Especialista em Engenharia de Requisitos e Metodologias Ágeis."},
        {"username": "prof.ricardo", "password": senha_hash, "role": "user", "email": "ricardo.ramos@ceub.br", "bio": "Professor doutor em Inteligência Artificial e Engenharia de Dados."},

        # Empresas
        {"username": "google_brasil", "password": senha_hash, "role": "user", "email": "parcerias@google.com", "bio": "Google Brasil - Divisão de Relacionamento com Universidades e Fomento de Inovação."},
        {"username": "meta_devs", "password": senha_hash, "role": "user", "email": "dev-relations@meta.com", "bio": "Meta Developer Relations - Apoio a projetos acadêmicos de Realidade Virtual e Web3."},
        {"username": "softex_df", "password": senha_hash, "role": "user", "email": "contato@softexdf.org.br", "bio": "Associação Softex DF - Fomento da Indústria de Software no Distrito Federal."}
    ]

    usuarios_db = {}
    for ud in usuarios_dados:
        u = User(username=ud["username"], password=ud["password"], role=ud["role"], email=ud["email"], bio=ud["bio"])
        db.session.add(u)
        usuarios_db[ud["username"]] = u
    
    db.session.commit()

    # ==========================================
    # 2. CRIANDO PROJETOS
    # ==========================================
    print("Cadastrando projetos no catálogo...")
    
    # Detalhes de projetos (em formato JSON para bater com o to_dict do modelo)
    detalhes_proj1 = [
        "Desenvolver um portal web responsivo para coletar e rastrear a entrada e saída de alunos nas catracas do UNICEUB.",
        "Tecnologias: HTML5, CSS3, Flask, SQLAlchemy e Chart.js.",
        "Gerar relatórios de picos de tráfego para a coordenação de segurança."
    ]
    detalhes_proj2 = [
        "Criar um aplicativo mobile nativo ou híbrido (Flutter/React Native) focado na saúde mental e atividades físicas dos estudantes universitários.",
        "Funcionalidades: Controle de treinos, dicas de bem-estar e fórum interno de apoio.",
        "Integração com sensores de passos do celular."
    ]
    detalhes_proj3 = [
        "Implementar um modelo de Machine Learning (com Scikit-Learn ou TensorFlow) integrado a um dashboard administrativo.",
        "O sistema analisará histórico de notas, faltas e engajamento no portal acadêmico para identificar alunos em risco de evasão.",
        "Orientação estrita em Python e Pandas."
    ]
    detalhes_proj4 = [
        "Projeto prático envolvendo microcontroladores ESP32 e sensores de temperatura/presença.",
        "Desenvolvimento do firmware em C++ e do painel web de controle em Python.",
        "Instalação prática nas salas de aula do bloco 3."
    ]

    projetos_dados = [
        {
            "id": 1,
            "titulo": "Portal de Monitoramento de Tráfego do UNICEUB",
            "status": "EM EXECUÇÃO",
            "professor": "Prof. Ana Carolina",
            "categoria": "Web",
            "descricao_curta": "Plataforma web integrada para análise de circulação de pessoas no campus do CEUB em tempo real.",
            "imagem": "img/default.png",
            "detalhes": json.dumps(detalhes_proj1),
            "links": json.dumps({"GitHub": "https://github.com/ceub/trafego-monitor", "Trello": "https://trello.com/b/trafego"}),
            "owner_username": "google_brasil"
        },
        {
            "id": 2,
            "titulo": "Aplicativo Mobile de Saúde e Bem-Estar Acadêmico",
            "status": "EM EXECUÇÃO",
            "professor": "Prof. Flávio Souza",
            "categoria": "Mobile",
            "descricao_curta": "Aplicativo para incentivar hábitos saudáveis e monitoramento de atividades físicas entre os alunos.",
            "imagem": "img/default.png",
            "detalhes": json.dumps(detalhes_proj2),
            "links": json.dumps({"Figma": "https://figma.com/design/saude-ceub"}),
            "owner_username": "meta_devs"
        },
        {
            "id": 3,
            "titulo": "Algoritmo de IA para Predição de Evasão Escolar",
            "status": "CONCLUÍDO",
            "professor": "Prof. Ricardo Ramos",
            "categoria": "Inteligência Artificial",
            "descricao_curta": "Modelo preditivo de ciência de dados para alertar a coordenação sobre riscos de evasão acadêmica.",
            "imagem": "img/default.png",
            "detalhes": json.dumps(detalhes_proj3),
            "links": json.dumps({"Artigo": "https://periodicos.uniceub.br/artigo-evasao"}),
            "owner_username": "prof.ricardo"
        },
        {
            "id": 4,
            "titulo": "Infraestrutura IoT para Salas de Aula Inteligentes",
            "status": "NÃO INICIADO",
            "professor": "Prof. Flávio Souza",
            "categoria": "IoT / Embarcados",
            "descricao_curta": "Automação e controle de iluminação e ar-condicionado baseados em presença física nas salas.",
            "imagem": "img/default.png",
            "detalhes": json.dumps(detalhes_proj4),
            "links": json.dumps({}),
            "owner_username": "softex_df"
        }
    ]

    for pd in projetos_dados:
        p = Project(
            id=pd["id"],
            titulo=pd["titulo"],
            status=pd["status"],
            professor=pd["professor"],
            categoria=pd["categoria"],
            descricao_curta=pd["descricao_curta"],
            imagem=pd["imagem"],
            detalhes=pd["detalhes"],
            links=pd["links"],
            owner_username=pd["owner_username"]
        )
        db.session.add(p)
    
    db.session.commit()

    # ==========================================
    # 3. CRIANDO SUBMISSÕES (Ideias de Empresas)
    # ==========================================
    print("Cadastrando submissões de ideias...")
    
    submissoes_dados = [
        # Sob análise
        {
            "nome_projeto": "Plataforma de E-commerce para Artesãos Locais",
            "categoria": "Web",
            "descricao": "Sistema web gratuito para divulgação e vendas de produtos de artesãos da feira da torre de Brasília.",
            "proponente": "Artesãos Associados DF",
            "email": "contato@artesmaos.df.gov.br",
            "status": "EM ANÁLISE",
            "username": "softex_df",
            "imagem": None
        },
        # Já aprovada (esta gerou o projeto id=4 na verdade, colocamos como histórico)
        {
            "nome_projeto": "Infraestrutura IoT para Salas de Aula Inteligentes",
            "categoria": "IoT / Embarcados",
            "descricao": "Automação de ar condicionado usando sensores ESP32.",
            "proponente": "Softex DF",
            "email": "parcerias@softexdf.org.br",
            "status": "APROVADA",
            "username": "softex_df",
            "imagem": None
        },
        # Rejeitada
        {
            "nome_projeto": "Plataforma de Apostas Esportivas entre Universitários",
            "categoria": "Web / Mobile",
            "descricao": "Sistema de palpites e apostas financeiras para campeonatos esportivos do UNICEUB.",
            "proponente": "Bets e Lazer Ltda",
            "email": "bet.lazer@outlook.com",
            "status": "REJEITADA",
            "username": "gabriel.silva",
            "imagem": None
        }
    ]

    for sd in submissoes_dados:
        s = Submission(
            nome_projeto=sd["nome_projeto"],
            categoria=sd["categoria"],
            descricao=sd["descricao"],
            proponente=sd["proponente"],
            email=sd["email"],
            status=sd["status"],
            username=sd["username"],
            imagem=sd["imagem"]
        )
        db.session.add(s)

    db.session.commit()

    # ==========================================
    # 4. CRIANDO CANDIDATURAS (Alunos em Projetos)
    # ==========================================
    print("Cadastrando candidaturas...")
    
    candidaturas_dados = [
        # Projeto 1 (Tráfego): Gabriel e Júlia aprovados (estão no workspace). Lucas pendente.
        {"projeto_id": 1, "username": "gabriel.silva", "motivo": "Quero muito aprender frontend e criar a dashboard do painel.", "experiencia": "Tenho bons conhecimentos em HTML/CSS e básico de Javascript.", "status": "APROVADA"},
        {"projeto_id": 1, "username": "julia.souza", "motivo": "Quero trabalhar na modelagem das tabelas do banco e no backend Flask.", "experiencia": "Concluí a matéria de banco de dados com nota 9.5 e uso Python.", "status": "APROVADA"},
        {"projeto_id": 1, "username": "lucas.nunes", "motivo": "Gostaria de ver o funcionamento técnico para criar a versão mobile em breve.", "experiencia": "Desenvolvo layouts no Figma e básico em Flutter.", "status": "PENDENTE"},
        
        # Projeto 2 (Saúde Mobile): Lucas aprovado. Mariana recusada.
        {"projeto_id": 2, "username": "lucas.nunes", "motivo": "Este projeto bate exatamente com o que estudo sobre aplicativos móveis.", "experiencia": "Criei 2 apps básicos de tarefas usando React Native no semestre passado.", "status": "APROVADA"},
        {"projeto_id": 2, "username": "mariana.costa", "motivo": "Gostaria de aplicar técnicas de análise de hábitos no aplicativo.", "experiencia": "Foco em Python puro e análise de dados no Jupyter.", "status": "REJEITADA"}
    ]

    for cd in candidaturas_dados:
        c = Application(
            projeto_id=cd["projeto_id"],
            username=cd["username"],
            motivo=cd["motivo"],
            experiencia=cd["experiencia"],
            status=cd["status"]
        )
        db.session.add(c)
        
    db.session.commit()

    # ==========================================
    # 5. CRIANDO MENSAGENS NO CHAT (WORKSPACE)
    # ==========================================
    print("Escrevendo mensagens no workspace de chat do Projeto 1...")
    
    # Mensagens trocadas no Projeto 1 (Monitoramento de Tráfego)
    tempo_base = datetime.utcnow() - timedelta(days=2)
    
    mensagens_dados = [
        {"projeto_id": 1, "username": "google_brasil", "texto": "Olá equipe! Sejam muito bem-vindos ao workspace do projeto de tráfego do CEUB. Estamos empolgados com essa parceria acadêmica!", "arquivo": None, "data_envio": tempo_base},
        {"projeto_id": 1, "username": "gabriel.silva", "texto": "Olá pessoal! Obrigado pela oportunidade de participar deste projeto. Já criei alguns rascunhos de telas no Figma.", "arquivo": None, "data_envio": tempo_base + timedelta(hours=2)},
        {"projeto_id": 1, "username": "julia.souza", "texto": "Olá a todos! Eu vou focar nas APIs e na integração do banco de dados SQLite. Quando podemos agendar uma reunião técnica?", "arquivo": None, "data_envio": tempo_base + timedelta(hours=4)},
        {"projeto_id": 1, "username": "google_brasil", "texto": "Excelente! Que tal quinta-feira às 14:30? Vou enviar o link do Google Meet.", "arquivo": None, "data_envio": tempo_base + timedelta(days=1)},
        {"projeto_id": 1, "username": "gabriel.silva", "texto": "Perfeito, agendado! Segue o arquivo em PDF com a proposta inicial de layout de telas para darmos uma olhada antes da reunião.", "arquivo": "img/uploads/layout_proposta.pdf", "data_envio": tempo_base + timedelta(days=1, hours=3)}
    ]

    for md in mensagens_dados:
        m = Message(
            projeto_id=md["projeto_id"],
            username=md["username"],
            texto=md["texto"],
            arquivo=md["arquivo"],
            data_envio=md["data_envio"]
        )
        db.session.add(m)
        
    db.session.commit()

    # ==========================================
    # 6. CRIANDO AVALIAÇÕES (Ratings de Projetos)
    # ==========================================
    print("Cadastrando avaliações em projetos...")
    
    avaliacoes_dados = [
        # Avaliações do Projeto 3 (IA de Evasão - Concluído)
        {"projeto_id": 3, "username": "gabriel.silva", "nota": 5, "comentario": "Projeto incrível! O professor Ricardo Ramos é um orientador sensacional, me ajudou muito com os algoritmos de classificação."},
        {"projeto_id": 3, "username": "julia.souza", "nota": 4, "comentario": "Trabalho muito bom e prático. Apenas os dados reais do portal acadêmico estavam um pouco difíceis de sanitizar, mas o aprendizado foi fantástico."},
        
        # Avaliação no Projeto 1 (Tráfego - Em Execução)
        {"projeto_id": 1, "username": "lucas.nunes", "nota": 5, "comentario": "Estou de fora acompanhando e o escopo técnico do projeto de tráfego é sensacional!"}
    ]

    for ad in avaliacoes_dados:
        r = Rating(
            projeto_id=ad["projeto_id"],
            username=ad["username"],
            nota=ad["nota"],
            comentario=ad["comentario"]
        )
        db.session.add(r)
        
    db.session.commit()

    # ==========================================
    # 7. CRIANDO NOTIFICAÇÕES
    # ==========================================
    print("Cadastrando notificações de teste...")
    
    notificacoes_dados = [
        {"username": "gabriel.silva", "mensagem": "🎉 Sua candidatura para o projeto 'Portal de Monitoramento de Tráfego do UNICEUB' foi APROVADA!", "lida": True, "link": "/projeto/1/workspace"},
        {"username": "lucas.nunes", "mensagem": "👤 Sua candidatura para o projeto 'Aplicativo Mobile de Saúde e Bem-Estar Acadêmico' foi APROVADA!", "lida": False, "link": "/projeto/2/workspace"},
        {"username": "google_brasil", "mensagem": "👤 lucas.nunes se candidatou ao seu projeto 'Portal de Monitoramento de Tráfego do UNICEUB'!", "lida": False, "link": "/perfil"}
    ]

    for nd in notificacoes_dados:
        n = Notification(
            username=nd["username"],
            mensagem=nd["mensagem"],
            lida=nd["lida"],
            link=nd["link"]
        )
        db.session.add(n)
        
    db.session.commit()

    # ==========================================
    # 8. CRIANDO LOGS DE ATIVIDADE (Auditoria do Admin)
    # ==========================================
    print("Criando logs de auditoria do sistema...")
    
    logs_dados = [
        {"username": "admin", "acao": "Login realizado", "detalhes": "Login de administrador feito com sucesso no painel."},
        {"username": "softex_df", "acao": "Submissão de projeto", "detalhes": "Empresa submeteu proposta 'Infraestrutura IoT para Salas de Aula Inteligentes'."},
        {"username": "admin", "acao": "Aprovou submissão", "detalhes": "Aprovação da submissão #2 e criação automática do Projeto #4."},
        {"username": "gabriel.silva", "acao": "Candidatura enviada", "detalhes": "Inscrição efetuada no Projeto #1 (Tráfego)."},
        {"username": "google_brasil", "acao": "Candidatura aprovada", "detalhes": "Aprovou o aluno gabriel.silva no projeto de tráfego."},
        {"username": "admin", "acao": "Exportou CSV", "detalhes": "Exportou CSV: usuarios"}
    ]

    for ld in logs_dados:
        log = ActivityLog(
            username=ld["username"],
            acao=ld["acao"],
            detalhes=ld["detalhes"]
        )
        db.session.add(log)
        
    db.session.commit()

print("Banco de dados do SisCPTI populado com sucesso com dados realistas!")
