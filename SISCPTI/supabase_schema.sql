-- SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
-- Todos os direitos reservados. Ver LICENSE.

-- ============================================================
--  SISCPTI — SCHEMA COMPLETO E ATUALIZADO PARA SUPABASE (POSTGRESQL)
--  Cole todo este script de uma vez no "SQL Editor" do Supabase
--  e clique em "RUN".
-- ============================================================

-- --------------------------------------------------------
-- 1. LIMPEZA PREVENTIVA DAS TABELAS ANTIGAS
-- --------------------------------------------------------
DROP TABLE IF EXISTS account_verification CASCADE;
DROP TABLE IF EXISTS password_reset       CASCADE;
DROP TABLE IF EXISTS activity_log         CASCADE;
DROP TABLE IF EXISTS notification         CASCADE;
DROP TABLE IF EXISTS rating               CASCADE;
DROP TABLE IF EXISTS task                 CASCADE;
DROP TABLE IF EXISTS message              CASCADE;
DROP TABLE IF EXISTS application          CASCADE;
DROP TABLE IF EXISTS submission           CASCADE;
DROP TABLE IF EXISTS project              CASCADE;
DROP TABLE IF EXISTS "user"               CASCADE;

-- --------------------------------------------------------
-- 2. CRIAÇÃO DAS TABELAS
-- --------------------------------------------------------

CREATE TABLE "user" (
    id               SERIAL       PRIMARY KEY,
    username         VARCHAR(50)  NOT NULL UNIQUE,
    password         VARCHAR(255) NOT NULL,
    role             VARCHAR(20)  NOT NULL DEFAULT 'user',
    email            VARCHAR(120),
    email_secundario VARCHAR(120),
    bio              VARCHAR(300),
    interesses       VARCHAR(300) DEFAULT '',
    ativo            BOOLEAN      NOT NULL DEFAULT TRUE,
    status_aprovacao VARCHAR(20)  NOT NULL DEFAULT 'APROVADO',
    data_cadastro    TIMESTAMPTZ  DEFAULT NOW(),
    email_verificado BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE project (
    id              SERIAL       PRIMARY KEY,
    titulo          VARCHAR(200) NOT NULL,
    status          VARCHAR(50)  NOT NULL,
    professor       VARCHAR(100) NOT NULL,
    professor_id    INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    categoria       VARCHAR(100) NOT NULL,
    descricao_curta VARCHAR(500) NOT NULL,
    imagem          VARCHAR(200) NOT NULL DEFAULT 'default_capa_1.jpg',
    detalhes        TEXT         NOT NULL,
    links           TEXT         NOT NULL DEFAULT '{}',
    owner_username  VARCHAR(50),
    owner_id        INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    tags            VARCHAR(300) DEFAULT '',
    concluido_em    TIMESTAMPTZ
);

CREATE TABLE submission (
    id           SERIAL       PRIMARY KEY,
    user_id      INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    nome_projeto VARCHAR(200) NOT NULL,
    categoria    VARCHAR(100) NOT NULL,
    descricao    TEXT         NOT NULL,
    proponente   VARCHAR(100) NOT NULL,
    email        VARCHAR(100) NOT NULL,
    status       VARCHAR(50)  NOT NULL DEFAULT 'EM ANÁLISE',
    username     VARCHAR(50),
    imagem       VARCHAR(200),
    tags         VARCHAR(300) DEFAULT '',
    projeto_id   INTEGER REFERENCES project(id) ON DELETE SET NULL
);

CREATE TABLE application (
    id          SERIAL      PRIMARY KEY,
    projeto_id  INTEGER     NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    username    VARCHAR(50) NOT NULL,
    motivo      TEXT        NOT NULL,
    experiencia TEXT        NOT NULL,
    status      VARCHAR(50) NOT NULL DEFAULT 'PENDENTE',
    CONSTRAINT uq_application_projeto_username UNIQUE (projeto_id, username)
);

CREATE TABLE message (
    id          SERIAL      PRIMARY KEY,
    projeto_id  INTEGER     NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    username    VARCHAR(50) NOT NULL,
    texto       TEXT,
    arquivo     VARCHAR(200),
    data_envio  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification (
    id           SERIAL      PRIMARY KEY,
    user_id      INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    username     VARCHAR(50) NOT NULL,
    mensagem     TEXT        NOT NULL,
    lida         BOOLEAN     NOT NULL DEFAULT FALSE,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    link         VARCHAR(200)
);

CREATE TABLE rating (
    id               SERIAL      PRIMARY KEY,
    projeto_id       INTEGER     NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    user_id          INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    username         VARCHAR(50) NOT NULL,
    nota             INTEGER     NOT NULL CHECK (nota BETWEEN 1 AND 5),
    nota_organizacao INTEGER     DEFAULT 5 CHECK (nota_organizacao BETWEEN 1 AND 5),
    nota_orientacao  INTEGER     DEFAULT 5 CHECK (nota_orientacao BETWEEN 1 AND 5),
    nota_aprendizado INTEGER     DEFAULT 5 CHECK (nota_aprendizado BETWEEN 1 AND 5),
    comentario       TEXT,
    data_criacao     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_log (
    id       SERIAL       PRIMARY KEY,
    username VARCHAR(50)  NOT NULL,
    acao     VARCHAR(100) NOT NULL,
    detalhes TEXT,
    data     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE password_reset (
    id        SERIAL       PRIMARY KEY,
    username  VARCHAR(50)  NOT NULL,
    token     VARCHAR(100) NOT NULL UNIQUE,
    expira_em TIMESTAMPTZ  NOT NULL
);

CREATE TABLE account_verification (
    id        SERIAL       PRIMARY KEY,
    username  VARCHAR(50)  NOT NULL,
    token     VARCHAR(100) NOT NULL UNIQUE,
    expira_em TIMESTAMPTZ  NOT NULL
);

CREATE TABLE task (
    id                SERIAL       PRIMARY KEY,
    projeto_id        INTEGER      NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    assigned_user_id  INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    titulo            VARCHAR(150) NOT NULL,
    descricao         TEXT,
    status            VARCHAR(50)  NOT NULL DEFAULT 'todo',
    assigned_username VARCHAR(50),
    deadline          DATE,
    checklist         TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ
);

-- --------------------------------------------------------
-- 3. ÍNDICES DE PERFORMANCE E CHAVES ESTRANGEIRAS
-- --------------------------------------------------------
CREATE INDEX idx_project_status         ON project(status);
CREATE INDEX idx_project_categoria      ON project(categoria);
CREATE INDEX idx_project_owner          ON project(owner_username);
CREATE INDEX idx_project_owner_id       ON project(owner_id);
CREATE INDEX idx_project_professor_id   ON project(professor_id);

CREATE INDEX idx_submission_user_id     ON submission(user_id);
CREATE INDEX idx_submission_status      ON submission(status);

CREATE INDEX idx_application_projeto    ON application(projeto_id);
CREATE INDEX idx_application_user       ON application(username);
CREATE INDEX idx_application_user_id    ON application(user_id);

CREATE INDEX idx_message_projeto        ON message(projeto_id);
CREATE INDEX idx_message_user_id        ON message(user_id);
CREATE INDEX idx_message_data           ON message(data_envio);

CREATE INDEX idx_notification_user      ON notification(username);
CREATE INDEX idx_notification_user_id   ON notification(user_id);
CREATE INDEX idx_notification_lida      ON notification(lida);

CREATE INDEX idx_rating_projeto         ON rating(projeto_id);
CREATE INDEX idx_rating_user_id         ON rating(user_id);

CREATE INDEX idx_task_projeto           ON task(projeto_id);
CREATE INDEX idx_task_assigned_user_id  ON task(assigned_user_id);
CREATE INDEX idx_task_status            ON task(status);

-- --------------------------------------------------------
-- 4. SUPABASE REALTIME (CHAT EM TEMPO REAL)
-- --------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'message'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE message;
    END IF;
END $$;

-- --------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS)
-- Habilita RLS com políticas de acesso para a aplicação operar normalmente
-- --------------------------------------------------------
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_user" ON "user";
CREATE POLICY "acesso_user" ON "user" FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE project ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_project" ON project;
CREATE POLICY "acesso_project" ON project FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE submission ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_submission" ON submission;
CREATE POLICY "acesso_submission" ON submission FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE application ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_application" ON application;
CREATE POLICY "acesso_application" ON application FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE message ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_message" ON message;
CREATE POLICY "acesso_message" ON message FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE notification ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_notification" ON notification;
CREATE POLICY "acesso_notification" ON notification FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE rating ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_rating" ON rating;
CREATE POLICY "acesso_rating" ON rating FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE task ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_task" ON task;
CREATE POLICY "acesso_task" ON task FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_activity_log" ON activity_log;
CREATE POLICY "acesso_activity_log" ON activity_log FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE password_reset ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_password_reset" ON password_reset;
CREATE POLICY "acesso_password_reset" ON password_reset FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE account_verification ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_account_verification" ON account_verification;
CREATE POLICY "acesso_account_verification" ON account_verification FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------
-- 6. USUÁRIOS INICIAIS
-- Senha padrão de todos: 1234
-- Hash gerado pelo Werkzeug (scrypt compatível):
-- scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82
-- --------------------------------------------------------
INSERT INTO "user" (username, password, role, email, bio, interesses, ativo, status_aprovacao, email_verificado) VALUES
-- Administrador geral
('admin',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'admin', 'admin@ceub.br', 'Super Administrador do sistema SisCPTI.', 'Gestão, Infraestrutura, Arquitetura', TRUE, 'APROVADO', TRUE),

-- Coordenador
('coord1',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'coordenador', 'coord1@ceub.br', 'Coordenador de Projetos de TI do UniCEUB.', 'Metodologia Ágil, Gestão de Projetos, Governança', TRUE, 'APROVADO', TRUE),

-- Autores do SisCPTI (Equipe de Desenvolvimento)
('guilherme.oliveira',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'admin', 'guilherme.oliveira@ceub.br', 'Coautor e Desenvolvedor Full Stack do SisCPTI.', 'React, TypeScript, Python, Flask, PostgreSQL', TRUE, 'APROVADO', TRUE),

('guilherme.gouveia',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'lider', 'guilherme.gouveia@ceub.br', 'Coautor e Scrum Master do SisCPTI.', 'Scrum, Gestão Ágil, Python, React', TRUE, 'APROVADO', TRUE),

('arthur.grangeiro',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'lider', 'arthur.grangeiro@ceub.br', 'Coautor e Product Owner do SisCPTI.', 'Product Management, Requisitos, Qualidade de Software', TRUE, 'APROVADO', TRUE),

('davi.souza',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'aluno', 'davi.souza@ceub.br', 'Coautor e Desenvolvedor do SisCPTI.', 'Frontend, UI/UX, Tailwind CSS, React', TRUE, 'APROVADO', TRUE),

-- Professores Orientadores
('prof.ana',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'professor', 'ana.silva@ceub.br', 'Professora Orientadora especialista em Engenharia de Software.', 'Engenharia de Software, Arquitetura, DevOps', TRUE, 'APROVADO', TRUE),

('prof.carlos',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'professor', 'carlos.souza@ceub.br', 'Professor Orientador especialista em IA, Ciência de Dados e Redes.', 'IA, Redes de Computadores, Segurança da Informação', TRUE, 'APROVADO', TRUE),

-- Estudantes
('aluno.lucas',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'aluno', 'lucas.silva@aluno.ceub.br', 'Estudante de Ciência da Computação, focado em frontend e mobile.', 'React, Flutter, UI/UX', TRUE, 'APROVADO', TRUE),

('aluno.julia',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'aluno', 'julia.santos@aluno.ceub.br', 'Estudante de Engenharia de Computação, focada em backend e infraestrutura.', 'Python, Docker, SQL', TRUE, 'APROVADO', TRUE),

('aluno.rodrigo',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'aluno', 'rodrigo.oliveira@aluno.ceub.br', 'Estudante de Análise e Desenvolvimento de Sistemas.', 'Flask, Vue.js, Node.js', TRUE, 'APROVADO', TRUE),

('lider.bruno',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'lider', 'bruno.lima@aluno.ceub.br', 'Estudante e Scrum Master da equipe.', 'Metodologias Ágeis, Django', TRUE, 'APROVADO', TRUE),

-- Parceiros Externos
('empresa.tech',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'empresa', 'contato@techsolutions.com.br', 'Empresa parceira com foco em soluções de nuvem.', 'Cloud, DevOps, AWS', TRUE, 'APROVADO', TRUE),

('cliente.maria',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'cliente', 'maria.po@cliente.com.br', 'Product Owner de projeto parceiro.', 'Inovação, Parcerias', TRUE, 'APROVADO', TRUE),

-- Usuário inativo / aguardando ativação
('user.inativo',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'aluno', 'inativo@aluno.ceub.br', 'Usuário aguardando ativação de e-mail.', 'HTML, CSS', FALSE, 'PENDENTE', FALSE);

-- --------------------------------------------------------
-- 7. PROJETOS INICIAIS
-- --------------------------------------------------------
INSERT INTO project (id, titulo, status, professor, professor_id, categoria, descricao_curta, imagem, detalhes, links, owner_username, tags) VALUES
(1, 'Portal de Vagas de Estágio CEUB', 'EM EXECUÇÃO', 'Ana Silva',
 (SELECT id FROM "user" WHERE username = 'prof.ana'), 'Web',
 'Plataforma para conectar alunos do UniCEUB a oportunidades de estágio e monitoria.',
 'default_capa_1.jpg',
 '[{"titulo":"Visão Geral","conteudo":"Desenvolvimento de uma solução tecnológica robusta para automatizar fluxos de processos acadêmicos."},{"titulo":"Arquitetura","conteudo":"Flask no backend, PostgreSQL e frontend dinâmico."},{"titulo":"Equipe","conteudo":"Lider: Bruno. Alunos: Lucas (Frontend), Julia (Backend)."}]',
 '{"github":"https://github.com/ceub/portal-vagas","trello":"https://trello.com/b/vagas-ceub"}',
 'guilherme.oliveira', 'Flask, Python, React, PostgreSQL'),

(2, 'Aplicativo de Caronas Compartilhadas Acadêmicas', 'EM EXECUÇÃO', 'Carlos Souza',
 (SELECT id FROM "user" WHERE username = 'prof.carlos'), 'Mobile',
 'Aplicativo móvel seguro para caronas entre estudantes e colaboradores do UniCEUB.',
 'default_capa_2.jpg',
 '[{"titulo":"Sobre o App","conteudo":"App móvel com geolocalização e verificação de e-mail institucional."},{"titulo":"Fases","conteudo":"1. Protótipo, 2. Integração com Maps, 3. Lançamento Beta."}]',
 '{"github":"https://github.com/ceub/caronas-app"}',
 'aluno.lucas', 'Flutter, Firebase, Kotlin, Maps'),

(3, 'Sistema de Gestão de TCC e Relatórios', 'CONCLUÍDO', 'Ana Silva',
 (SELECT id FROM "user" WHERE username = 'prof.ana'), 'Web',
 'Ferramenta automatizada para entrega, revisão e banca avaliadora de TCCs.',
 'default_capa_3.jpg',
 '[{"titulo":"Status","conteudo":"Concluído com sucesso e homologado pela coordenação."},{"titulo":"Documentos","conteudo":"Disponíveis para download na secretaria virtual."}]',
 '{"github":"https://github.com/ceub/tcc-gestor"}',
 'aluno.julia', 'Django, Python, Bootstrap, SQLite'),

(4, 'Analisador de Sentimentos de Ouvidoria por IA', 'AGUARDANDO INÍCIO', 'Carlos Souza',
 (SELECT id FROM "user" WHERE username = 'prof.carlos'), 'Inteligência Artificial',
 'Modelo de PLN para categorização automática das manifestações da ouvidoria do CEUB.',
 'default_capa_1.jpg',
 '[{"titulo":"Escopo","conteudo":"Análise preditiva utilizando técnicas de aprendizado de máquina supervisionado."}]',
 '{}',
 'guilherme.gouveia', 'Python, NLTK, Scikit-Learn, Pandas');

-- --------------------------------------------------------
-- 8. SUBMISSÕES DE PROJETOS
-- --------------------------------------------------------
INSERT INTO submission (nome_projeto, categoria, descricao, proponente, email, status, username, tags) VALUES
('App de Controle de Frequência via QR Code', 'Mobile',
 'Aplicativo para chamada digital nas salas de aula através da leitura de QR Code dinâmico.',
 'Coordenação de Engenharia', 'eng.coord@ceub.br', 'EM ANÁLISE', 'admin', 'React Native, Node.js'),

('Plataforma de Mentorias Aluno-a-Aluno', 'Web',
 'Rede social para veteranos oferecerem mentorias acadêmicas a calouros com gamificação.',
 'Diretório Acadêmico', 'da@ceub.br', 'APROVADO', 'coord1', 'Vue.js, Express, MongoDB'),

('Dashboard Integrado de Recursos de TI', 'Web',
 'Dashboard para visualização em tempo real do status dos laboratórios e servidores.',
 'Departamento de Infraestrutura', 'infra@ceub.br', 'REJEITADO', 'admin', 'Django, Grafana, Zabbix');

-- --------------------------------------------------------
-- 9. CANDIDATURAS
-- --------------------------------------------------------
INSERT INTO application (projeto_id, username, motivo, experiencia, status) VALUES
(1, 'davi.souza',
 'Gostaria de atuar no desenvolvimento da interface web e integração de APIs.',
 'Experiência com React, Tailwind CSS e consumo de APIs REST.', 'APROVADA'),

(1, 'aluno.rodrigo',
 'Gostaria muito de trabalhar no desenvolvimento do portal pois tenho interesse em Flask.',
 'Já desenvolvi pequenos projetos web usando Flask e SQLite.', 'APROVADA'),

(2, 'aluno.julia',
 'Tenho interesse em aprender Flutter e mobile development.',
 'Tenho conhecimento em Java e POO.', 'PENDENTE'),

(4, 'aluno.lucas',
 'Quero aprofundar meus conhecimentos em IA e Machine Learning.',
 'Concluí disciplinas de IA e análise estatística.', 'PENDENTE');

-- --------------------------------------------------------
-- 10. MENSAGENS DE CHAT
-- --------------------------------------------------------
INSERT INTO message (projeto_id, username, texto, data_envio) VALUES
(1, 'guilherme.oliveira',
 'Olá pessoal! Sejam bem-vindos ao workspace do projeto. Vamos usar este chat para alinhamentos rápidos.',
 NOW() - INTERVAL '3 days'),
(1, 'guilherme.gouveia',
 'Excelente! As tarefas da primeira sprint já foram definidas no quadro Kanban.',
 NOW() - INTERVAL '2 days 22 hours'),
(1, 'davi.souza',
 'Perfeito! Já estou estruturando os componentes de tela e a responsividade.',
 NOW() - INTERVAL '2 days 20 hours'),
(1, 'prof.ana',
 'Excelente organização, equipe. Acompanharei as entregas das sprints por aqui.',
 NOW() - INTERVAL '1 day 12 hours');

-- --------------------------------------------------------
-- 11. AVALIAÇÕES
-- --------------------------------------------------------
INSERT INTO rating (projeto_id, username, nota, nota_organizacao, nota_orientacao, nota_aprendizado, comentario, data_criacao) VALUES
(3, 'aluno.julia', 5, 5, 5, 5,
 'Excelente projeto! Conseguimos implementar tudo conforme o planejado.',
 NOW() - INTERVAL '10 days'),
(3, 'aluno.lucas', 4, 4, 5, 4,
 'Ótimo projeto, aprendi muito sobre Django e modelagem de banco de dados.',
 NOW() - INTERVAL '9 days');

-- --------------------------------------------------------
-- 12. TAREFAS (KANBAN)
-- --------------------------------------------------------
INSERT INTO task (projeto_id, titulo, descricao, status, assigned_username, deadline, checklist, created_at, completed_at) VALUES
(1, 'Modelagem Conceitual do Banco de Dados',
 'Criar DER e mapeamento lógico das tabelas no PostgreSQL.',
 'done', 'guilherme.oliveira', CURRENT_DATE - 5,
 '[{"text":"Criar DER no dbdiagram.io","done":true},{"text":"Mapear chaves estrangeiras","done":true},{"text":"Gerar script DDL inicial","done":true}]',
 NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days'),

(1, 'Desenvolvimento do Fluxo de Cadastro e Login',
 'Codificar rotas de autenticação, hashing de senhas e envio de e-mail de ativação.',
 'doing', 'guilherme.oliveira', CURRENT_DATE + 2,
 '[{"text":"Criar tela de Cadastro","done":true},{"text":"Configurar envio de e-mail","done":true},{"text":"Desenvolver redefinição de senha","done":true}]',
 NOW() - INTERVAL '2 days', NULL),

(1, 'Criar Interface Responsiva do Workspace',
 'Construir sidebar colapsável, chat lateral e aba de métricas com suporte mobile.',
 'doing', 'davi.souza', CURRENT_DATE + 1,
 '[{"text":"Ajustar sidebars no mobile","done":true},{"text":"Integrar gráfico do Gantt","done":false}]',
 NOW() - INTERVAL '3 days', NULL),

(1, 'Configurar deploy contínuo no Vercel',
 'Configurar arquivo vercel.json e variáveis de ambiente.',
 'todo', 'arthur.grangeiro', CURRENT_DATE + 7,
 '[{"text":"Criar arquivo vercel.json","done":true},{"text":"Vincular variáveis de ambiente no Vercel","done":true}]',
 NOW() - INTERVAL '1 day', NULL),

(2, 'Configuração Inicial do Flutter',
 'Iniciar repositório, configurar SDK do Flutter e carregar pacotes iniciais.',
 'done', 'aluno.lucas', CURRENT_DATE - 3,
 '[{"text":"Rodar flutter create","done":true},{"text":"Configurar Firebase Core","done":true}]',
 NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'),

(2, 'Integração com Google Maps API',
 'Consumir mapas para traçar rotas de caronas e pontos de encontro.',
 'todo', 'aluno.lucas', CURRENT_DATE + 5,
 '[{"text":"Obter chave da API do Maps","done":false},{"text":"Renderizar mapa básico na tela","done":false}]',
 NOW() - INTERVAL '1 day', NULL);

-- --------------------------------------------------------
-- 13. NOTIFICAÇÕES
-- --------------------------------------------------------
INSERT INTO notification (username, mensagem, lida, link) VALUES
('guilherme.oliveira', 'Sua submissão de projeto foi aprovada pelo coordenador!', FALSE, '/projetos'),
('davi.souza',          'Você foi atribuído à tarefa: Criar Interface Responsiva do Workspace.', TRUE, '/projeto/1/workspace'),
('prof.ana',             'Nova candidatura recebida para o projeto: Portal de Vagas de Estágio CEUB.', FALSE, '/projeto/1/workspace');

-- --------------------------------------------------------
-- 14. LOGS DE ATIVIDADE
-- --------------------------------------------------------
INSERT INTO activity_log (username, acao, detalhes, data) VALUES
('coord1',             'Aprovação de Proposta',  'Proposta "Plataforma de Mentorias Aluno-a-Aluno" foi aprovada.',                NOW() - INTERVAL '4 days'),
('guilherme.gouveia',  'Movimentação de Kanban', 'Tarefa "Modelagem Conceitual do Banco de Dados" movida para CONCLUÍDO.',        NOW() - INTERVAL '2 days'),
('guilherme.oliveira', 'Edição de Perfil',       'Foto de perfil e interesses foram atualizados.',                                 NOW() - INTERVAL '4 hours');

-- --------------------------------------------------------
-- 15. TOKEN DE VERIFICAÇÃO (USUÁRIO INATIVO)
-- --------------------------------------------------------
INSERT INTO account_verification (username, token, expira_em) VALUES
('user.inativo', gen_random_uuid()::text, NOW() + INTERVAL '1 day');

-- --------------------------------------------------------
-- 16. PREENCHIMENTO AUTOMÁTICO DE CHAVES ESTRANGEIRAS (user_id / owner_id)
-- --------------------------------------------------------
UPDATE project p      SET owner_id = u.id         FROM "user" u WHERE p.owner_username = u.username;
UPDATE submission s   SET user_id = u.id          FROM "user" u WHERE s.username = u.username;
UPDATE application a  SET user_id = u.id          FROM "user" u WHERE a.username = u.username;
UPDATE message m      SET user_id = u.id          FROM "user" u WHERE m.username = u.username;
UPDATE notification n SET user_id = u.id          FROM "user" u WHERE n.username = u.username;
UPDATE rating r       SET user_id = u.id          FROM "user" u WHERE r.username = u.username;
UPDATE task t         SET assigned_user_id = u.id FROM "user" u WHERE t.assigned_username = u.username;

-- --------------------------------------------------------
-- 17. SINCRONIZAÇÃO DAS SEQUÊNCIAS (EVITA ERRO DE ID DUPLICADO EM INSERTS)
-- --------------------------------------------------------
SELECT setval('user_id_seq', COALESCE((SELECT MAX(id) FROM "user"), 1));
SELECT setval('project_id_seq', COALESCE((SELECT MAX(id) FROM project), 1));
SELECT setval('submission_id_seq', COALESCE((SELECT MAX(id) FROM submission), 1));
SELECT setval('application_id_seq', COALESCE((SELECT MAX(id) FROM application), 1));
SELECT setval('task_id_seq', COALESCE((SELECT MAX(id) FROM task), 1));
SELECT setval('message_id_seq', COALESCE((SELECT MAX(id) FROM message), 1));
SELECT setval('notification_id_seq', COALESCE((SELECT MAX(id) FROM notification), 1));
SELECT setval('rating_id_seq', COALESCE((SELECT MAX(id) FROM rating), 1));
SELECT setval('activity_log_id_seq', COALESCE((SELECT MAX(id) FROM activity_log), 1));

-- Fim do script. Executado com sucesso!
