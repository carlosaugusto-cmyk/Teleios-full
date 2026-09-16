/**
 * Google Drive API v3 Service for Cloudflare Workers & Node.js
 * Supports:
 * 1. OAuth 2.0 Authorization Code Flow with Offline Access (Refresh Tokens)
 * 2. Service Account JWT (RS256/Web Crypto) as fallback
 * No external Node dependencies required.
 */

export interface GoogleDriveCredentials {
  mode?: 'oauth' | 'service_account';
  // OAuth 2.0 Credentials
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  // Service Account Credentials (fallback)
  serviceAccountEmail?: string;
  privateKey?: string;
  // Folder & Metadata
  rootFolderId?: string;
  rootFolderName?: string;
  projectId?: string;
}

export type GoogleServiceAccountCredentials = GoogleDriveCredentials;

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  iconLink?: string;
  modifiedTime?: string;
  createdTime?: string;
  parents?: string[];
  isFolder: boolean;
}

export interface DriveQuotaInfo {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
}

export interface DriveUserInfo {
  displayName?: string;
  emailAddress?: string;
  photoLink?: string;
}

export interface DriveConnectionTestResult {
  success: boolean;
  message: string;
  mode?: 'oauth' | 'service_account';
  user?: DriveUserInfo;
  quota?: DriveQuotaInfo;
  rootFolder?: {
    id: string;
    name: string;
  };
  error?: string;
}

// In-memory token cache for worker lifecycle
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Converte chave privada PEM (PKCS#8) em ArrayBuffer para Web Crypto
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleanPem = pem
    .replace(/-----BEGIN[ A-Z_-]+-----/g, '')
    .replace(/-----END[ A-Z_-]+-----/g, '')
    .replace(/\s+/g, '');

  const binaryString = atob(cleanPem);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converte Uint8Array em base64url sem padding
 */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function stringToBase64Url(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

// ─── OAUTH 2.0 HELPERS ────────────────────────────────────────────────────────

/**
 * Constrói a URL de autorização OAuth 2.0 do Google
 */
export function buildGoogleOAuthUrl(options: {
  clientId: string;
  redirectUri: string;
  state?: string;
  scope?: string;
}): string {
  const defaultScope = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: options.clientId.trim(),
    redirect_uri: options.redirectUri.trim(),
    response_type: 'code',
    scope: options.scope || defaultScope,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });

  if (options.state) {
    params.set('state', options.state);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Troca o authorization_code por Access Token e Refresh Token
 */
export async function exchangeOAuthCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
  tokenType: string;
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code: code.trim(),
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      redirect_uri: redirectUri.trim(),
      grant_type: 'authorization_code',
    }).toString(),
  });

  const data = await res.json<any>();

  if (!res.ok || !data.access_token) {
    const errorMsg = data.error_description || data.error || 'Falha ao trocar código de autorização por tokens.';
    throw new Error(`Google OAuth2 Erro: ${errorMsg}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
    scope: data.scope,
    tokenType: data.token_type || 'Bearer',
  };
}

/**
 * Renova o Access Token usando o Refresh Token
 */
export async function refreshOAuthAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      refresh_token: refreshToken.trim(),
      grant_type: 'refresh_token',
    }).toString(),
  });

  const data = await res.json<any>();

  if (!res.ok || !data.access_token) {
    const errorMsg = data.error_description || data.error || 'Falha ao renovar o Access Token.';
    throw new Error(`Google OAuth2 Refresh Erro: ${errorMsg}`);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Revoga um token OAuth2 no Google
 */
export async function revokeGoogleToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token.trim())}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Consulta perfil do usuário e cota de armazenamento no Drive
 */
export async function fetchDriveAbout(accessToken: string): Promise<{
  user?: DriveUserInfo;
  quota?: DriveQuotaInfo;
}> {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json<any>().catch(() => ({}));
    throw new Error(err.error?.message || 'Falha ao consultar informações da conta do Google Drive.');
  }
  const data = await res.json<any>();
  return {
    user: data.user,
    quota: data.storageQuota,
  };
}

// ─── SERVICE ACCOUNT JWT HELPER ───────────────────────────────────────────────

/**
 * Gera token via Service Account JWT RS256
 */
async function getServiceAccountAccessToken(
  credentials: GoogleDriveCredentials,
  forceRefresh = false
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);

  if (!forceRefresh && cachedToken && cachedToken.expiresAt > nowSec + 60) {
    return cachedToken.token;
  }

  if (!credentials.serviceAccountEmail || !credentials.privateKey) {
    throw new Error('Credenciais da Service Account incompletas (e-mail e private_key são obrigatórios).');
  }

  let privateKeyPem = credentials.privateKey;
  if (privateKeyPem.includes('\\n')) {
    privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: credentials.serviceAccountEmail.trim(),
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: nowSec + 3600,
    iat: nowSec,
  };

  const encodedHeader = stringToBase64Url(JSON.stringify(header));
  const encodedPayload = stringToBase64Url(JSON.stringify(payload));
  const signInput = `${encodedHeader}.${encodedPayload}`;

  let cryptoKey: CryptoKey;
  try {
    const keyBuffer = pemToArrayBuffer(privateKeyPem);
    cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
  } catch (err: any) {
    throw new Error(
      `Formato inválido da chave privada RSA da Service Account. Certifique-se de copiar o bloco completo BEGIN PRIVATE KEY / END PRIVATE KEY: ${err.message}`
    );
  }

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signInput)
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signatureBuffer));
  const assertionJwt = `${signInput}.${encodedSignature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertionJwt,
    }).toString(),
  });

  const tokenData = await tokenRes.json<any>();

  if (!tokenRes.ok || !tokenData.access_token) {
    const errorDetail = tokenData.error_description || tokenData.error || 'Falha ao autenticar com o Google OAuth2.';
    throw new Error(`Google OAuth2 Erro: ${errorDetail}`);
  }

  cachedToken = {
    token: tokenData.access_token,
    expiresAt: nowSec + (tokenData.expires_in || 3600),
  };

  return tokenData.access_token;
}

// ─── UNIFIED TOKEN RETRIEVAL ──────────────────────────────────────────────────

/**
 * Obtém um Access Token válido, suportando OAuth 2.0 (com renovação automática via Refresh Token)
 * ou Service Account como fallback.
 */
export async function getGoogleAccessToken(
  credentials: GoogleDriveCredentials,
  forceRefresh = false,
  onTokenRefreshed?: (newToken: string, expiresAt: number) => Promise<void>
): Promise<string> {
  const isOAuth = credentials.mode === 'oauth' || Boolean(credentials.refreshToken);

  // 1. Fluxo OAuth 2.0 (Recomendado)
  if (isOAuth) {
    if (!credentials.refreshToken) {
      throw new Error(
        'Google Drive não está conectado via OAuth. Acesse Integrações > Google Drive e clique em "Conectar meu Google Drive".'
      );
    }

    const nowMs = Date.now();
    const tokenExpiresAt = credentials.expiresAt || 0;

    // Se o token existente ainda for válido por pelo menos 90 segundos
    if (!forceRefresh && credentials.accessToken && tokenExpiresAt > nowMs + 90000) {
      return credentials.accessToken;
    }

    // Se estiver em cache em memória
    if (!forceRefresh && cachedToken && cachedToken.expiresAt > Math.floor(nowMs / 1000) + 90) {
      return cachedToken.token;
    }

    // Renova usando refresh_token
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new Error('Client ID e Client Secret do Google OAuth são necessários para renovar o token.');
    }

    const refreshed = await refreshOAuthAccessToken(
      credentials.clientId,
      credentials.clientSecret,
      credentials.refreshToken
    );

    const newExpiresAt = nowMs + (refreshed.expiresIn * 1000);

    cachedToken = {
      token: refreshed.accessToken,
      expiresAt: Math.floor(newExpiresAt / 1000),
    };

    if (onTokenRefreshed) {
      await onTokenRefreshed(refreshed.accessToken, newExpiresAt);
    }

    return refreshed.accessToken;
  }

  // 2. Fluxo Service Account (Fallback)
  if (credentials.serviceAccountEmail && credentials.privateKey) {
    return getServiceAccountAccessToken(credentials, forceRefresh);
  }

  throw new Error(
    'Nenhuma credencial do Google Drive encontrada. Conecte sua conta do Google via OAuth ou informe as credenciais da Service Account.'
  );
}

// ─── DRIVE OPERATIONS ─────────────────────────────────────────────────────────

/**
 * Testa a conexão com a API do Google Drive v3
 */
export async function testGoogleDriveConnection(
  credentials: GoogleDriveCredentials,
  onTokenRefreshed?: (newToken: string, expiresAt: number) => Promise<void>
): Promise<DriveConnectionTestResult> {
  try {
    const isOAuth = credentials.mode === 'oauth' || Boolean(credentials.refreshToken);
    const token = await getGoogleAccessToken(credentials, true, onTokenRefreshed);

    const aboutData = await fetchDriveAbout(token);

    let rootFolderResult: { id: string; name: string } | undefined = undefined;

    // Se informou ID da pasta raiz, verifica se ela existe e tem permissão
    if (credentials.rootFolderId && credentials.rootFolderId.trim()) {
      const folderId = credentials.rootFolderId.trim();
      const folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (folderRes.ok) {
        const folderData = await folderRes.json<any>();
        if (folderData.trashed) {
          return {
            success: false,
            message: `A pasta informada "${folderData.name}" está na lixeira do Google Drive.`,
            error: 'Pasta na lixeira',
          };
        }
        rootFolderResult = {
          id: folderData.id,
          name: folderData.name,
        };
      } else {
        const folderErr = await folderRes.json<any>().catch(() => ({}));
        return {
          success: false,
          message: `Conexão autorizada, porém a pasta ID "${folderId}" não foi encontrada no Drive. Verifique se o ID está correto.`,
          error: folderErr.error?.message || 'Pasta não encontrada',
          user: aboutData.user,
          quota: aboutData.quota,
        };
      }
    }

    const connectedAccount = aboutData.user?.emailAddress || (isOAuth ? 'Conta Google OAuth' : credentials.serviceAccountEmail);

    return {
      success: true,
      mode: isOAuth ? 'oauth' : 'service_account',
      message: `Google Drive conectado com sucesso para ${connectedAccount}!`,
      user: aboutData.user,
      quota: aboutData.quota,
      rootFolder: rootFolderResult,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Falha ao conectar com o Google Drive.',
      error: err.message,
    };
  }
}

/**
 * Lista arquivos e pastas do Google Drive
 */
export async function listGoogleDriveFiles(
  credentials: GoogleDriveCredentials,
  options: {
    folderId?: string;
    search?: string;
    mimeTypeFilter?: string;
    pageSize?: number;
    pageToken?: string;
  } = {},
  onTokenRefreshed?: (newToken: string, expiresAt: number) => Promise<void>
): Promise<{ files: DriveFileItem[]; nextPageToken?: string }> {
  const token = await getGoogleAccessToken(credentials, false, onTokenRefreshed);
  const pageSize = options.pageSize || 40;

  const queryParts: string[] = ['trashed = false'];

  const targetFolderId = options.folderId || credentials.rootFolderId;
  const isOAuth = credentials.mode === 'oauth' || Boolean(credentials.refreshToken);

  if (targetFolderId && targetFolderId.trim() && !options.search) {
    queryParts.push(`'${targetFolderId.trim()}' in parents`);
  } else if (!options.search && isOAuth && !targetFolderId) {
    // No modo OAuth, se nenhuma pasta raiz for especificada, lista a raiz do próprio usuário
    queryParts.push("'root' in parents");
  }

  if (options.search && options.search.trim()) {
    const escaped = options.search.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  if (options.mimeTypeFilter) {
    if (options.mimeTypeFilter === 'folder') {
      queryParts.push("mimeType = 'application/vnd.google-apps.folder'");
    } else if (options.mimeTypeFilter === 'document') {
      queryParts.push(
        "(mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'application/pdf' or mimeType contains 'document' or mimeType contains 'word')"
      );
    } else if (options.mimeTypeFilter === 'image') {
      queryParts.push("mimeType contains 'image/'");
    } else if (options.mimeTypeFilter === 'video') {
      queryParts.push("mimeType contains 'video/'");
    }
  }

  const q = queryParts.join(' and ');
  const fields =
    'nextPageToken,files(id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink,iconLink,modifiedTime,createdTime,parents)';
  const orderBy = 'folder,modifiedTime desc,name';

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', fields);
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('orderBy', orderBy);
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  if (options.pageToken) {
    url.searchParams.set('pageToken', options.pageToken);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json<any>();

  if (!res.ok) {
    throw new Error(data.error?.message || 'Falha ao listar arquivos do Google Drive.');
  }

  const files: DriveFileItem[] = (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? Number(f.size) : undefined,
    webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    webContentLink: f.webContentLink,
    thumbnailLink: f.thumbnailLink,
    iconLink: f.iconLink,
    modifiedTime: f.modifiedTime,
    createdTime: f.createdTime,
    parents: f.parents,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }));

  return {
    files,
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Obtém metadados de um arquivo no Google Drive
 */
export async function getGoogleDriveFile(
  credentials: GoogleDriveCredentials,
  fileId: string,
  onTokenRefreshed?: (newToken: string, expiresAt: number) => Promise<void>
): Promise<DriveFileItem> {
  const token = await getGoogleAccessToken(credentials, false, onTokenRefreshed);
  const fields =
    'id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink,iconLink,modifiedTime,createdTime,parents';

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json<any>();
  if (!res.ok) {
    throw new Error(data.error?.message || `Falha ao buscar arquivo ${fileId} no Google Drive.`);
  }

  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    size: data.size ? Number(data.size) : undefined,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    webContentLink: data.webContentLink,
    thumbnailLink: data.thumbnailLink,
    iconLink: data.iconLink,
    modifiedTime: data.modifiedTime,
    createdTime: data.createdTime,
    parents: data.parents,
    isFolder: data.mimeType === 'application/vnd.google-apps.folder',
  };
}

/**
 * Baixa o conteúdo de um arquivo do Google Drive
 */
export async function downloadGoogleDriveFileContent(
  credentials: GoogleDriveCredentials,
  fileId: string,
  onTokenRefreshed?: (newToken: string, expiresAt: number) => Promise<void>
): Promise<{ textContent: string; buffer: ArrayBuffer; mimeType: string; name: string }> {
  const token = await getGoogleAccessToken(credentials, false, onTokenRefreshed);
  const metadata = await getGoogleDriveFile(credentials, fileId, onTokenRefreshed);

  let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  let resultMimeType = metadata.mimeType;

  if (metadata.mimeType === 'application/vnd.google-apps.document') {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain&supportsAllDrives=true`;
    resultMimeType = 'text/plain';
  } else if (metadata.mimeType === 'application/vnd.google-apps.spreadsheet') {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv&supportsAllDrives=true`;
    resultMimeType = 'text/csv';
  }

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao baixar arquivo do Google Drive (${res.status}): ${errText}`);
  }

  const buffer = await res.arrayBuffer();
  let textContent = '';

  if (
    resultMimeType.startsWith('text/') ||
    resultMimeType.includes('json') ||
    resultMimeType.includes('csv')
  ) {
    textContent = new TextDecoder('utf-8').decode(buffer);
  }

  return {
    textContent,
    buffer,
    mimeType: resultMimeType,
    name: metadata.name,
  };
}

/**
 * Faz o upload real de um arquivo para o Google Drive
 */
export async function uploadFileToGoogleDrive(
  credentials: GoogleDriveCredentials,
  params: {
    fileName: string;
    mimeType: string;
    content: ArrayBuffer | Uint8Array | string;
    parentFolderId?: string;
  },
  onTokenRefreshed?: (newToken: string, expiresAt: number) => Promise<void>
): Promise<{ driveFileId: string; webViewLink: string; name: string }> {
  const token = await getGoogleAccessToken(credentials, false, onTokenRefreshed);
  const folderId = params.parentFolderId || credentials.rootFolderId;

  const metadata: Record<string, any> = {
    name: params.fileName,
    mimeType: params.mimeType,
  };

  if (folderId && folderId.trim()) {
    metadata.parents = [folderId.trim()];
  }

  const boundary = `-------TeleiosBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;

  let contentBytes: Uint8Array;
  if (typeof params.content === 'string') {
    contentBytes = new TextEncoder().encode(params.content);
  } else if (params.content instanceof Uint8Array) {
    contentBytes = params.content;
  } else {
    contentBytes = new Uint8Array(params.content);
  }

  const headerPart = `${delimiter}${metaPart}${delimiter}Content-Type: ${params.mimeType}\r\n\r\n`;
  const headerBytes = new TextEncoder().encode(headerPart);
  const footerBytes = new TextEncoder().encode(closeDelimiter);

  const fullPayload = new Uint8Array(headerBytes.length + contentBytes.length + footerBytes.length);
  fullPayload.set(headerBytes, 0);
  fullPayload.set(contentBytes, headerBytes.length);
  fullPayload.set(footerBytes, headerBytes.length + contentBytes.length);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullPayload,
    }
  );

  const data = await uploadRes.json<any>();

  if (!uploadRes.ok) {
    throw new Error(data.error?.message || 'Falha ao enviar arquivo para o Google Drive.');
  }

  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions?supportsAllDrives=true`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch {
    // Ignore permission error
  }

  return {
    driveFileId: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view?usp=sharing`,
    name: data.name,
  };
}
