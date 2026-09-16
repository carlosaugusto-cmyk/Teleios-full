/**
 * Utilitário para geração de payload Pix (BR Code) oficial padrão Banco Central / EMVCo QRCPS-MPM.
 * Gera a string de "Pix Copia e Cola" e o conteúdo para renderização em QR Code.
 */

function formatTLV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Remove acentuação e caracteres especiais para conformidade com a especificação EMVCo
 */
function sanitizeAscii(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
}

/**
 * Normaliza e higieniza a chave Pix de acordo com as especificações do BACEN
 */
export function sanitizePixKey(key: string, keyType?: string): string {
  let clean = key.trim();
  if (!clean) return '';

  // E-mail: caixa baixa sem espaços
  if (keyType === 'email' || clean.includes('@')) {
    return clean.toLowerCase();
  }

  // CPF ou CNPJ: apenas números (11 ou 14 dígitos)
  if (keyType === 'cpf' || keyType === 'cnpj') {
    return clean.replace(/\D/g, '');
  }

  // Telefone celular: padrão internacional E.164 (+55...)
  if (keyType === 'phone' || /^[+0-9() -]+$/.test(clean)) {
    const digits = clean.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) {
      return `+55${digits}`;
    }
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      return `+${digits}`;
    }
    if (clean.startsWith('+')) {
      return clean.replace(/[\s()-]/g, '');
    }
    return `+${digits}`;
  }

  // Chave aleatória (EVP): padrão UUID com hífens
  return clean.toLowerCase();
}

/**
 * Cálculo do CRC16-CCITT (Polinômio 0x1021, valor inicial 0xFFFF)
 */
function calculateCRC16(str: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export interface PixPayloadParams {
  key: string;
  keyType?: string;
  receiverName: string;
  receiverCity: string;
  amount?: number;
  txid?: string;
  description?: string;
}

/**
 * Gera o payload oficial do Pix (BR Code)
 */
export function generatePixPayload({
  key,
  keyType,
  receiverName,
  receiverCity,
  amount,
  txid = '***',
  description,
}: PixPayloadParams): string {
  if (!key) return '';

  const cleanKey = sanitizePixKey(key, keyType);
  const cleanName = sanitizeAscii(receiverName || 'MINISTERIO TELEIOS').slice(0, 25) || 'TELEIOS';
  const cleanCity = sanitizeAscii(receiverCity || 'SAO PAULO').slice(0, 15) || 'SAO PAULO';
  const cleanTxid = txid && txid !== '***' ? sanitizeAscii(txid).slice(0, 25) || '***' : '***';

  // 00: Payload Format Indicator (01)
  let payload = formatTLV('00', '01');

  // Tag 01 (Point of Initiation Method):
  // No padrão do Banco Central (BACEN) para QR Code Estático com Chave Direta (mesmo com valor definido),
  // a Tag 01 deve ser omitida ou conter '11'.
  // O valor '12' é EXCLUSIVO para QR Code Dinâmico gerado via API Pix com URL de payload no subcampo 25.
  // Usar '12' fazia os aplicativos bancários rejeitarem o código como inválido.

  // 26: Merchant Account Information - Pix
  let merchantAccount = formatTLV('00', 'br.gov.bcb.pix');
  merchantAccount += formatTLV('01', cleanKey);
  if (description) {
    const cleanDesc = sanitizeAscii(description).slice(0, 25);
    if (cleanDesc) {
      merchantAccount += formatTLV('02', cleanDesc);
    }
  }
  payload += formatTLV('26', merchantAccount);

  // 52: Merchant Category Code (0000 = padrão)
  payload += formatTLV('52', '0000');

  // 53: Transaction Currency (986 = Real brasileiro ISO 4217)
  payload += formatTLV('53', '986');

  // 54: Transaction Amount (opcional, se informado formata com 2 casas decimais)
  if (amount && amount > 0) {
    payload += formatTLV('54', amount.toFixed(2));
  }

  // 58: Country Code
  payload += formatTLV('58', 'BR');

  // 59: Merchant Name
  payload += formatTLV('59', cleanName);

  // 60: Merchant City
  payload += formatTLV('60', cleanCity);

  // 62: Additional Data Field Template
  const additionalData = formatTLV('05', cleanTxid);
  payload += formatTLV('62', additionalData);

  // 63: CRC16 (Tag '63', tamanho '04')
  const payloadToCrc = `${payload}6304`;
  const crc = calculateCRC16(payloadToCrc);

  return `${payloadToCrc}${crc}`;
}
