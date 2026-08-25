import dotenv from 'dotenv';
dotenv.config();

export interface EnvironmentConfig {
  DATABASE_URL: string;
  REDIS_URL: string;
  GEMINI_API_KEY: string;
  GOOGLE_SERVICE_ACCOUNT_KEY?: string;
  WHASTMEO_API_URL: string;
  WHASTMEO_TOKEN: string;
  WHASTMEO_DEFAULT_RECIPIENT?: string;
  YOUTUBE_CLIENT_ID?: string;
  YOUTUBE_CLIENT_SECRET?: string;
  RUST_GATEWAY_URL?: string;
  RUST_GATEWAY_SECRET?: string;
  PORT: number;
  NODE_ENV: string;
}

export function validateAndLoadEnv(): EnvironmentConfig {
  const config: EnvironmentConfig = {
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/autohub_db?schema=public',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    WHASTMEO_API_URL: process.env.WHASTMEO_API_URL || 'http://localhost:8080',
    WHASTMEO_TOKEN: process.env.WHASTMEO_TOKEN || 'whastmeo_demo_token_vps',
    WHASTMEO_DEFAULT_RECIPIENT: process.env.WHASTMEO_DEFAULT_RECIPIENT || '5511999998888',
    YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
    PORT: Number(process.env.PORT) || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  if (!config.GEMINI_API_KEY && process.env.NODE_ENV === 'production') {
    console.warn('[CONFIG] AVISO: GEMINI_API_KEY não encontrada nas variáveis de ambiente. Verifique o arquivo .env');
  }

  return config;
}

export const env = validateAndLoadEnv();
