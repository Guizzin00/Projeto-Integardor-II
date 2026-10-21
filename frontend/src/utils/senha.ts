/** Política de senha (espelha o backend): mínimo de 8 caracteres, com letras e números. */
export const DICA_SENHA = 'Use no mínimo 8 caracteres, com letras e números.';

export function validarSenha(senha: string): string | null {
  if (senha.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return 'A senha deve conter letras e números.';
  return null;
}
