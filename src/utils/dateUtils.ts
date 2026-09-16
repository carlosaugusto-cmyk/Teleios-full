/**
 * Utilitários de manipulação e conversão de datas para resolução de fusos horários (UTC / UTC-3).
 */

/**
 * Converte uma data ISO (UTC) vinda do backend para o formato aceito pelo
 * input HTML datetime-local (YYYY-MM-DDTHH:mm) considerando o fuso horário local do navegador.
 * Evita o bug de adiantar 3 horas ao fatiar strings UTC.
 */
export function toLocalDatetimeInputValue(isoStr?: string | null): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';

    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

/**
 * Converte o valor do input datetime-local (YYYY-MM-DDTHH:mm) para ISO UTC correto.
 */
export function fromLocalDatetimeInputValue(localStr?: string | null): string | undefined {
  if (!localStr || !localStr.trim()) return undefined;
  try {
    const d = new Date(localStr.trim());
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Formata uma data ISO para exibição amigável em Português do Brasil (ex: "03/09/2026 às 15:30").
 */
export function formatLocalDateTime(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '—';
    const date = d.toLocaleDateString('pt-BR');
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${date} às ${time}`;
  } catch {
    return '—';
  }
}

/**
 * Verifica se uma data agendada já foi atingida/ultrapassada em relação ao momento atual.
 */
export function isScheduledPassed(scheduledAt?: string | null): boolean {
  if (!scheduledAt) return true;
  try {
    const d = new Date(scheduledAt);
    return !isNaN(d.getTime()) && d.getTime() <= Date.now();
  } catch {
    return true;
  }
}
