/**
 * Compatibilidade sanguínea para doação
 * Retorna se um tipo de doador pode doar para um tipo receptor
 */

const COMPATIBILIDADE = {
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'O-': ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
  'A+': ['A+', 'AB+'],
  'A-': ['A+', 'A-', 'AB+', 'AB-'],
  'B+': ['B+', 'AB+'],
  'B-': ['B+', 'B-', 'AB+', 'AB-'],
  'AB+': ['AB+'],
  'AB-': ['AB+', 'AB-'],
};

/**
 * Verifica se o doador (tipoDoador) pode doar para o receptor (tipoReceptor)
 * @param {string} tipoDoador - Ex: 'O+', 'A-'
 * @param {string} tipoReceptor
 * @returns {boolean}
 */
export function isCompativel(tipoDoador, tipoReceptor) {
  if (!tipoDoador || !tipoReceptor) return false;
  const receptores = COMPATIBILIDADE[tipoDoador];
  return receptores ? receptores.includes(tipoReceptor) : false;
}

/**
 * Lista tipos sanguíneos que podem receber do tipo informado
 * @param {string} tipoDoador
 * @returns {string[]}
 */
export function getReceptoresCompatíveis(tipoDoador) {
  return COMPATIBILIDADE[tipoDoador] || [];
}
