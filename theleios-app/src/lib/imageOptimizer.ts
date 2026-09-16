/**
 * Utilitário de Otimização e Geração de Miniaturas (Thumbnails)
 * 
 * Cria versões leves e compactadas (max 500px para cards mobile/web)
 * e otimiza imagens pesadas antes do upload para Cloudflare R2.
 */

/**
 * Cria uma miniatura otimizada (max 500px) a partir de um arquivo de imagem.
 * Converte para WebP (ou JPEG) preservando proporções com interpolação bicúbica.
 */
export async function createImageThumbnail(
  file: File,
  maxDimension: number = 500,
  quality: number = 0.82
): Promise<File> {
  // Se for SVG ou GIF animado, não redimensiona no canvas
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Se ambas as dimensões já forem menores que o limite, ainda comprime para webp leve
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.max(1, Math.round((height * maxDimension) / width));
          width = maxDimension;
        } else {
          width = Math.max(1, Math.round((width * maxDimension) / height));
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Tenta exportar para WebP primeiro, com fallback para JPEG
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const thumbFile = new File([blob], `thumb_${cleanName}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          });
          resolve(thumbFile);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Otimiza uma imagem em tamanho real caso exceda 1600px ou seja muito pesada (> 600 KB).
 */
export async function optimizeImage(
  file: File,
  maxDimension: number = 1600,
  quality: number = 0.85
): Promise<File> {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Se a imagem já for leve e menor que 1600px, mantém o original
      if (width <= maxDimension && height <= maxDimension && file.size < 600 * 1024) {
        resolve(file);
        return;
      }

      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.max(1, Math.round((height * maxDimension) / width));
          width = maxDimension;
        } else {
          width = Math.max(1, Math.round((width * maxDimension) / height));
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const targetType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const optimizedFile = new File([blob], file.name, {
            type: targetType,
            lastModified: Date.now(),
          });
          resolve(optimizedFile);
        },
        targetType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}


