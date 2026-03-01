/**
 * Regras de disponibilidade para doação de sangue
 * Homens: 60 dias entre doações | Mulheres: 90 dias
 */

const DIAS_INTERVALO_HOMEM = 60;
const DIAS_INTERVALO_MULHER = 90;

/**
 * Retorna o número de dias de intervalo obrigatório conforme o sexo
 * @param {'M'|'F'} sexo
 * @returns {number}
 */
export function getDiasIntervalo(sexo) {
  return sexo === 'F' ? DIAS_INTERVALO_MULHER : DIAS_INTERVALO_HOMEM;
}

/**
 * Calcula a próxima data permitida para doação
 * @param {string} dataUltimaDoacao - ISO string da última doação
 * @param {'M'|'F'} sexo
 * @returns {Date}
 */
export function getProximaDataPermitida(dataUltimaDoacao, sexo) {
  if (!dataUltimaDoacao) return null;
  const dias = getDiasIntervalo(sexo);
  const ultima = new Date(dataUltimaDoacao);
  const proxima = new Date(ultima);
  proxima.setDate(proxima.getDate() + dias);
  return proxima;
}

/**
 * Verifica se o doador está disponível para doar (já passou o intervalo)
 * @param {string|null} dataUltimaDoacao
 * @param {'M'|'F'} sexo
 * @returns {boolean}
 */
export function podeDoar(dataUltimaDoacao, sexo) {
  if (!dataUltimaDoacao) return true;
  const proxima = getProximaDataPermitida(dataUltimaDoacao, sexo);
  return new Date() >= proxima;
}

/**
 * Retorna quantos dias faltam para a próxima doação permitida
 * @param {string|null} dataUltimaDoacao
 * @param {'M'|'F'} sexo
 * @returns {{ dias: number, disponivel: boolean, proximaData: Date|null }}
 */
export function getContagemRegressiva(dataUltimaDoacao, sexo) {
  if (!dataUltimaDoacao) {
    return { dias: 0, disponivel: true, proximaData: null };
  }
  const proxima = getProximaDataPermitida(dataUltimaDoacao, sexo);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  proxima.setHours(0, 0, 0, 0);
  const diff = Math.ceil((proxima - hoje) / (1000 * 60 * 60 * 24));
  return {
    dias: Math.max(0, diff),
    disponivel: diff <= 0,
    proximaData: proxima,
  };
}
