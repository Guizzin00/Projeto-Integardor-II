-- SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
-- Todos os direitos reservados. Ver LICENSE.

-- ============================================================
--  SISCPTI — SCHEMA COMPLETO E 100% ZERADO PARA SUPABASE (POSTGRESQL)
--  Cole todo este script de uma vez no "SQL Editor" do Supabase
--  e clique em "RUN".
-- ============================================================

-- --------------------------------------------------------
-- 1. LIMPEZA COMPLETA DE TODAS AS TABELAS ANTIGAS
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
-- 2. CRIAÇÃO DAS TABELAS ESTRUTURAIS
-- --------------------------------------------------------

-- Tabela de Usuários (Autenticação por Matrícula ou E-mail)
CREATE TABLE "user" (
    id               SERIAL       PRIMARY KEY,
    username         VARCHAR(50)  NOT NULL UNIQUE,  -- Nome de usuário / handle único
    matricula        VARCHAR(30)  UNIQUE,           -- Matrícula institucional CEUB
    email            VARCHAR(120) NOT NULL UNIQUE,  -- E-mail institucional ou de contato principal
    password         VARCHAR(255) NOT NULL,
    role             VARCHAR(20)  NOT NULL DEFAULT 'aluno', -- 'aluno', 'lider', 'professor', 'coordenador', 'admin', 'empresa', 'cliente'
    email_secundario VARCHAR(120),
    bio              VARCHAR(300),
    interesses       VARCHAR(300) DEFAULT '',
    ativo            BOOLEAN      NOT NULL DEFAULT FALSE,
    status_aprovacao VARCHAR(20)  NOT NULL DEFAULT 'APROVADO', -- 'PENDENTE', 'APROVADO', 'REJEITADO'
    data_cadastro    TIMESTAMPTZ  DEFAULT NOW(),
    email_verificado BOOLEAN      NOT NULL DEFAULT FALSE
);

-- Tabela de Projetos do Caderno de TI
CREATE TABLE project (
    id              SERIAL       PRIMARY KEY,
    titulo          VARCHAR(200) NOT NULL,
    status          VARCHAR(50)  NOT NULL DEFAULT 'EM EXECUÇÃO', -- 'EM EXECUÇÃO', 'CONCLUÍDO', 'AGUARDANDO INÍCIO'
    professor       VARCHAR(100) NOT NULL,
    professor_id    INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    categoria       VARCHAR(100) NOT NULL,
    descricao_curta VARCHAR(500) NOT NULL,
    imagem          VARCHAR(200) NOT NULL DEFAULT 'default_capa_1.jpg',
    detalhes        TEXT         NOT NULL DEFAULT '[]',
    links           TEXT         NOT NULL DEFAULT '{}',
    owner_username  VARCHAR(50),
    owner_id        INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    tags            VARCHAR(300) DEFAULT '',
    concluido_em    TIMESTAMPTZ
);

-- Tabela de Submissões / Propostas de Desafios e Projetos
CREATE TABLE submission (
    id           SERIAL       PRIMARY KEY,
    user_id      INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    nome_projeto VARCHAR(200) NOT NULL,
    categoria    VARCHAR(100) NOT NULL,
    descricao    TEXT         NOT NULL,
    proponente   VARCHAR(100) NOT NULL,
    email        VARCHAR(100) NOT NULL,
    status       VARCHAR(50)  NOT NULL DEFAULT 'EM ANÁLISE', -- 'EM ANÁLISE', 'APROVADO', 'REJEITADO'
    username     VARCHAR(50),
    imagem       VARCHAR(200),
    tags         VARCHAR(300) DEFAULT '',
    projeto_id   INTEGER REFERENCES project(id) ON DELETE SET NULL
);

-- Tabela de Candidaturas de Estudantes aos Projetos
CREATE TABLE application (
    id          SERIAL      PRIMARY KEY,
    projeto_id  INTEGER     NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    username    VARCHAR(50) NOT NULL,
    motivo      TEXT        NOT NULL,
    experiencia TEXT        NOT NULL,
    status      VARCHAR(50) NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'APROVADA', 'REJEITADA'
    CONSTRAINT uq_application_projeto_username UNIQUE (projeto_id, username)
);

-- Tabela de Mensagens do Chat em Tempo Real
CREATE TABLE message (
    id          SERIAL      PRIMARY KEY,
    projeto_id  INTEGER     NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    username    VARCHAR(50) NOT NULL,
    texto       TEXT,
    arquivo     VARCHAR(200),
    data_envio  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Notificações Internas
CREATE TABLE notification (
    id           SERIAL      PRIMARY KEY,
    user_id      INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    username     VARCHAR(50) NOT NULL,
    mensagem     TEXT        NOT NULL,
    lida         BOOLEAN     NOT NULL DEFAULT FALSE,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    link         VARCHAR(200)
);

-- Tabela de Avaliações Multidimensionais
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

-- Tabela de Logs de Auditoria
CREATE TABLE activity_log (
    id       SERIAL       PRIMARY KEY,
    username VARCHAR(50)  NOT NULL,
    acao     VARCHAR(100) NOT NULL,
    detalhes TEXT,
    data     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Tabela de Tokens de Recuperação de Senha
CREATE TABLE password_reset (
    id        SERIAL       PRIMARY KEY,
    username  VARCHAR(50)  NOT NULL,
    token     VARCHAR(100) NOT NULL UNIQUE,
    expira_em TIMESTAMPTZ  NOT NULL
);

-- Tabela de Tokens de Ativação / Validação de E-mail
CREATE TABLE account_verification (
    id        SERIAL       PRIMARY KEY,
    username  VARCHAR(50)  NOT NULL,
    token     VARCHAR(100) NOT NULL UNIQUE,
    expira_em TIMESTAMPTZ  NOT NULL
);

-- Tabela de Tarefas Ágeis (Kanban)
CREATE TABLE task (
    id                SERIAL       PRIMARY KEY,
    projeto_id        INTEGER      NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    assigned_user_id  INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    titulo            VARCHAR(150) NOT NULL,
    descricao         TEXT,
    status            VARCHAR(50)  NOT NULL DEFAULT 'todo', -- 'todo', 'doing', 'done'
    assigned_username VARCHAR(50),
    deadline          DATE,
    checklist         TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ
);

-- --------------------------------------------------------
-- 3. ÍNDICES DE PERFORMANCE E CHAVES ESTRANGEIRAS
-- --------------------------------------------------------
-- Índices case-insensitive para login ultrarrápido por Nome de Usuário, Matrícula ou E-mail
CREATE UNIQUE INDEX idx_user_username_lower  ON "user" (LOWER(username));
CREATE UNIQUE INDEX idx_user_matricula_lower ON "user" (LOWER(matricula)) WHERE matricula IS NOT NULL;
CREATE UNIQUE INDEX idx_user_email_lower     ON "user" (LOWER(email));

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
-- 6. USUÁRIO ADMINISTRADOR INICIAL (OPCIONAL)
-- Login por Usuário: admin | Matrícula: 000000 | E-mail: admin@ceub.br
-- Senha padrão: 1234
-- (Se desejar o banco 100% sem nenhum registro, basta comentar ou apagar o INSERT abaixo)
-- --------------------------------------------------------
INSERT INTO "user" (username, matricula, email, password, role, ativo, status_aprovacao, email_verificado) VALUES
('admin', '000000', 'admin@ceub.br',
 'scrypt:32768:8:1$1VRiIdbCwqFSOKOJ$6d9177ad14859708a06cd5e58cd6d866864874539ef9b374f8a7879594091636285fb06c0314a9dc066fe028c0bd2651d41a8cff5c7a73a43b8919cf37526a82',
 'admin', TRUE, 'APROVADO', TRUE);

-- --------------------------------------------------------
-- 7. REINICIALIZAÇÃO DAS SEQUÊNCIAS
-- --------------------------------------------------------
SELECT setval('user_id_seq', COALESCE((SELECT MAX(id) FROM "user"), 1));
SELECT setval('project_id_seq', 1, false);
SELECT setval('submission_id_seq', 1, false);
SELECT setval('application_id_seq', 1, false);
SELECT setval('task_id_seq', 1, false);
SELECT setval('message_id_seq', 1, false);
SELECT setval('notification_id_seq', 1, false);
SELECT setval('rating_id_seq', 1, false);
SELECT setval('activity_log_id_seq', 1, false);

-- Fim do script. Banco limpo e pronto para uso!
