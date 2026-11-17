/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

// Mesmas regras de validar_candidatura (routes_project.py)
export const CANDIDATURA_MAX = 2000;

export function erroCandidatura(motivo: string): string {
  const texto = motivo.trim();
  if (!texto) return 'Conte por que você quer participar do projeto.';
  return '';
}

interface Props {
  motivo: string;
  experiencia: string;
  onMotivo: (valor: string) => void;
  onExperiencia: (valor: string) => void;
}

const campoClasse =
  'p-3 border border-border-color rounded-md text-base bg-bg-primary text-text-primary resize-y transition-all focus:border-purple-primary focus:outline-none';

export function CamposCandidatura({ motivo, experiencia, onMotivo, onExperiencia }: Props) {
  return (
    <>
      <p className="m-0 text-xs text-text-secondary">
        Campos marcados com <span className="text-rose-600 font-bold">*</span> são obrigatórios.
      </p>

      <div className="flex flex-col">
        <label htmlFor="motivo" className="font-semibold text-purple-primary mb-1.5">
          Por que você quer participar deste projeto? <span className="text-rose-600" aria-hidden="true">*</span>
        </label>
        <textarea
          id="motivo"
          rows={4}
          required
          aria-required="true"
          aria-describedby="motivo-ajuda"
          maxLength={CANDIDATURA_MAX}
          placeholder="Explique seu interesse e motivação..."
          value={motivo}
          onChange={(e) => onMotivo(e.target.value)}
          className={campoClasse}
        ></textarea>
        <div id="motivo-ajuda" className="flex justify-end mt-1 text-xs text-text-secondary">
          <span>{motivo.length}/{CANDIDATURA_MAX}</span>
        </div>
      </div>

      <div className="flex flex-col mt-2">
        <label htmlFor="experiencia" className="font-semibold text-purple-primary mb-1.5">
          Qual sua experiência prévia? <span className="font-normal text-text-secondary">(opcional)</span>
        </label>
        <textarea
          id="experiencia"
          rows={3}
          maxLength={CANDIDATURA_MAX}
          placeholder="Linguagens, frameworks, cursos..."
          value={experiencia}
          onChange={(e) => onExperiencia(e.target.value)}
          className={campoClasse}
        ></textarea>
        <div className="text-right mt-1 text-xs text-text-secondary">{experiencia.length}/{CANDIDATURA_MAX}</div>
      </div>
    </>
  );
}
