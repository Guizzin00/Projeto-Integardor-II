/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { Link } from 'react-router-dom';

export function Home() {
  return (
    <>
      <section className="hero">
        <h1>Caderno de Projetos de TI</h1>
        <p>Gestão e acompanhamento dos projetos acadêmicos e institucionais do UniCEUB.</p>
        <Link to="/projetos" className="btn">Ver Projetos</Link>
      </section>

      <section className="info-section">
        <h2>Informações Importantes</h2>

        <p>
          As disciplinas de <strong>Projeto Integrador (PI)</strong> e <strong>Projeto Final (PF)</strong> têm como principal objetivo
          proporcionar aos alunos uma experiência prática e imersiva na resolução de problemas reais, em parceria com o
          ambiente acadêmico do UniCEUB, empresas parceiras e organizações do terceiro setor.
        </p>

        <p>
          Durante um ou mais semestres letivos, os discentes aplicam suas competências técnicas e metodológicas no desenvolvimento de
          soluções tecnológicas, validando hipóteses e funcionalidades. Além disso, as disciplinas fortalecem habilidades
          interpessoais e de gestão, preparando os estudantes para a atuação em equipe e o exercício da liderança de projetos.
        </p>

        <p>
          É fundamental destacar que os projetos desenvolvidos podem não incluir suporte continuado, manutenção preventiva ou
          garantia de continuidade após o término do período letivo. O foco central das disciplinas é a <strong>experimentação</strong> e
          a <strong>validação de ideias</strong>, permitindo que os estudantes enfrentem desafios autênticos e aprimorem suas
          competências técnicas e comportamentais em um ambiente acadêmico diretamente conectado às demandas do mercado de trabalho.
        </p>

        <p>
          Para os <strong>parceiros internos e externos</strong>, esta é uma oportunidade estratégica de transformar ideias em experimentos
          e testar novas hipóteses em ambiente controlado. Os alunos envolvidos são profissionais em formação, providos de sólida
          fundamentação teórica e prática para contribuir para o desenvolvimento de soluções alinhadas às expectativas do mercado. Caso haja
          interesse na continuidade ou evolução do projeto, o parceiro poderá propor novos desdobramentos, respeitando sempre a natureza
          pedagógica e formativa das atividades acadêmicas.
        </p>

        <p>
          Para os <strong>estudantes</strong>, o PI/PF representa uma jornada formativa transformadora, permitindo vivenciar todas as etapas
          do ciclo de vida de uma solução tecnológica — desde a concepção e a ideação até a entrega funcional. Essa trajetória proporciona
          uma compreensão prática da dinâmica de mercado e do impacto transformador da tecnologia na sociedade.
        </p>

        <p>
          Para os <strong>professores orientadores</strong>, a disciplina atua como um <em>laboratório de inovação aplicada</em>, no qual
          conceitos teóricos e metodologias ágeis e ativas são testados, adaptados e consolidados na prática pedagógica.
        </p>

        <p>
          Ao participar do PI/PF, todas as partes compreendem que o resultado final poderá se concretizar como um{' '}
          <strong>Produto Mínimo Viável (MVP)</strong>, uma <strong>Prova de Conceito (PoC)</strong> ou um{' '}
          <strong>Protótipo Funcional</strong>, cujo propósito essencial é materializar ideias e hipóteses em soluções funcionais e verificáveis.
        </p>

        <p>
          O êxito de cada projeto não reside exclusivamente na entrega do artefato tecnológico, mas no aprendizado colaborativo
          construído entre estudantes, docentes e parceiros, somado à validação de hipóteses que respondem a desafios concretos em suas
          respectivas áreas de atuação. Dessa forma, as disciplinas contribuem expressivamente tanto para a formação profissional de excelência
          dos alunos quanto para o fomento da inovação tecnológica na sociedade.
        </p>
      </section>

    </>
  );
}
