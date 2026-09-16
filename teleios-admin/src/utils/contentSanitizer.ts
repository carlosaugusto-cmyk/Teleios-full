import { Study } from '../types/index.ts';
import { apiFetch } from '../services/api.service.ts';

/**
 * Verifica se o conteúdo do estudo é composto por dados binários (ex: bytes brutos de PDF).
 */
export function isStudyBinary(study?: Study | null): boolean {
  if (!study || !study.rawContent) return false;
  const sample = study.rawContent.slice(0, 150);
  return (
    sample.includes('%PDF') ||
    sample.includes('HTTP/2 200') ||
    sample.includes('content-type: application/octet-stream') ||
    /[\x00-\x08\x0E-\x1F]/.test(sample)
  );
}

/**
 * Obtém um resumo limpo e seguro para renderizar no card de preview,
 * evitando que milhões de caracteres binários saturem o DOM.
 */
export function getStudyPreviewText(study?: Study | null): string {
  if (!study) return '';
  if (study.summary && study.summary.trim()) {
    return study.summary.slice(0, 300);
  }

  if (isStudyBinary(study)) {
    const fileName = study.mediaFile?.originalName || 'Documento PDF Anexo';
    return `Arquivo de estudo anexado: ${fileName}. Clique para ler ou baixar o documento completo.`;
  }

  const raw = study.rawContent || study.content;
  if (!raw || !raw.trim()) {
    return 'Conteúdo do estudo disponível para leitura e aprofundamento na Palavra.';
  }

  // Remove quebras de linha excessivas e trunca
  const clean = raw.replace(/[\x00-\x08\x0E-\x1F]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > 250 ? clean.slice(0, 250) + '...' : clean;
}

/**
 * Deriva um título legível e limpo para o estudo.
 */
export function getStudyTitle(study?: Study | null): string {
  if (!study) return 'Conteúdo Bíblico';

  const raw = (study.rawContent || study.content || '').trim();
  const title = (study.title || '').trim();
  const isGenericTitle = !title || /^(devocional|estudo|estudo bíblico|conteúdo|conteúdo bíblico)$/i.test(title);

  if (!isGenericTitle) {
    return title;
  }

  // Se o título for genérico ou ausente, tentar extrair da primeira linha significativa do conteúdo
  if (raw && !raw.startsWith('%PDF')) {
    const lines = raw
      .split('\n')
      .map((l) => l.trim().replace(/^["'#*\s]+|["'#*\s]+$/g, ''))
      .filter((l) => l.length > 0);

    if (lines.length > 0) {
      if (lines.length > 1 && lines[0].toUpperCase().includes('DEVOCIONAL') && lines[1].toUpperCase().startsWith('TEMA')) {
        return `${lines[0]} - ${lines[1]}`;
      }
      if (lines[0].length <= 100) {
        return lines[0];
      }
      return lines[0].slice(0, 97) + '...';
    }
  }

  if (title) return title;

  if (study.mediaFile?.originalName) {
    return study.mediaFile.originalName.replace(/\.[^/.]+$/, '').replace(/[_\-]/g, ' ');
  }

  return study.type || 'Estudo Bíblico';
}

/**
 * Fetch seguro com timeout (padrão 8 segundos) para evitar loops infinitos ou carregamentos travados.
 */
export async function safeApiFetch<T>(path: string, timeoutMs: number = 8000): Promise<{ success: boolean; data?: T; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await apiFetch(path, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { success: false, error: `Erro na requisição (HTTP ${res.status})` };
    }

    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return { success: false, error: 'Resposta da API em formato inválido' };
    }

    if (json.success && json.data !== undefined) {
      return { success: true, data: json.data };
    }
    return { success: json.success ?? true, data: json };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Tempo limite de resposta excedido. Verifique sua conexão.' };
    }
    return { success: false, error: err.message || 'Falha ao comunicar com o servidor.' };
  }
}
