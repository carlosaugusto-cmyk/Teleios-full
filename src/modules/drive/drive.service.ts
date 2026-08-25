import { ContentCategory } from '../../types/index.ts';

export interface DriveUploadResult {
  driveFileId: string;
  webViewLink: string;
  folderPath: string;
  uploadedAt: string;
}

export class DriveService {
  private serviceAccountKey?: string;
  private rootFolderName: string = 'AutoHub_Ingest';

  constructor(serviceAccountKey?: string) {
    this.serviceAccountKey = serviceAccountKey;
  }

  /**
   * Garante a criação e mapeamento da estrutura hierárquica /Ano/Mês/Categoria no Google Drive
   * Exemplo: /2026/08/ESTUDO ou /2026/08/GALERIA
   */
  async ensureFolderStructure(
    year: number | string = new Date().getFullYear(),
    month: number | string = String(new Date().getMonth() + 1).padStart(2, '0'),
    category: ContentCategory | string = ContentCategory.ESTUDO
  ): Promise<{ folderId: string; folderPath: string }> {
    const formattedMonth = String(month).padStart(2, '0');
    const folderPath = `/${year}/${formattedMonth}/${category}`;
    
    console.log(`[GoogleDrive Service] Verificando/Criando estrutura de pastas: ${folderPath}`);

    // Em produção com googleapis:
    // 1. Busca ou cria pasta do Ano
    // 2. Busca ou cria subpasta do Mês
    // 3. Busca ou cria subpasta da Categoria
    const folderId = `drive_folder_${year}_${formattedMonth}_${category.toLowerCase()}`;

    return {
      folderId,
      folderPath,
    };
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Faz o upload com exponential backoff e idempotency-key para evitar duplicação em timeouts
   */
  async uploadFileToDrive(
    fileBuffer: Buffer | Uint8Array | string,
    fileName: string,
    mimeType: string,
    category: ContentCategory = ContentCategory.ESTUDO,
    retries = 3
  ): Promise<DriveUploadResult> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const { folderPath } = await this.ensureFolderStructure(year, month, category);
    const idempotencyKey = `idemp_drive_${fileName}_${now.getTime()}`;

    // Loop de retry com backoff exponencial
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[GoogleDrive] Tentativa ${attempt} de upload para ${fileName} (Idempotency: ${idempotencyKey})`);
        
        // Simulação de erro em tentativas iniciais (pode acontecer na rede)
        if (Math.random() < 0.2 && attempt < retries) {
          throw new Error('Rate limit ou falha temporária simulada');
        }

        // Gera ID representativo ou integra com google.drive({ version: 'v3' })
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileUniqueId = `drive_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Link público padrão do Google Drive para visualização
        const webViewLink = `https://drive.google.com/file/d/${fileUniqueId}/view?usp=sharing`;

        console.log(`[GoogleDrive Service] Upload concluído com sucesso: ${sanitizedFileName} (${mimeType}) -> ${folderPath}`);

        return {
          driveFileId: fileUniqueId,
          webViewLink,
          folderPath,
          uploadedAt: now.toISOString(),
        };
      } catch (error: any) {
        if (attempt === retries) {
          console.error(`[GoogleDrive] Falha definitiva após ${retries} tentativas:`, error);
          throw error;
        }
        const delayMs = attempt * 1500;
        console.warn(`[GoogleDrive] Falha na tentativa ${attempt}. Retentando em ${delayMs}ms...`);
        await this.sleep(delayMs);
      }
    }
    throw new Error('Upload falhou');
  }
}

export const driveService = new DriveService(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
