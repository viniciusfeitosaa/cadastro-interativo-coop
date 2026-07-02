import { z } from 'zod';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Schema de validação das variáveis de ambiente
const envSchema = z.object({
  // Servidor
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),

  // Banco de Dados
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().optional(),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Redis (rate limit distribuído + filas BullMQ)
  REDIS_URL: z.string().optional(),

  // Timeouts
  HTTP_REQUEST_TIMEOUT_MS: z.string().default('30000'),
  HTTP_EXTERNAL_TIMEOUT_MS: z.string().default('10000'),
  PRISMA_QUERY_TIMEOUT_MS: z.string().default('10000'),

  // Rate limit por rota sensível (req/min por IP)
  RATE_LIMIT_AUTH_MAX_PER_MIN: z.string().default('100'),
  RATE_LIMIT_PUBLIC_FORM_MAX_PER_MIN: z.string().default('30'),
  // Segurança
  BCRYPT_ROUNDS: z.string().default('12'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('500'),

  // Criptografia em repouso (AES-256-GCM) — opcional; gere com openssl rand -hex 32
  FIELD_ENCRYPTION_KEY: z.string().optional(),

  // Circuit breaker para APIs externas
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.string().default('5'),
  CIRCUIT_BREAKER_RESET_MS: z.string().default('60000'),

  // CORS
  FRONTEND_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // Multi-tenant / Master
  TENANT_DEFAULT_SLUG: z.string().default('seja-viva-saude'),
  MASTER_INITIAL_EMAIL: z.string().email().default('contato@sejavivasaude.com.br'),
  MASTER_INITIAL_NAME: z.string().default('Administrador Master'),
  MASTER_INITIAL_PASSWORD: z.string().min(8, 'MASTER_INITIAL_PASSWORD deve ter pelo menos 8 caracteres').optional(),

  // E-mail: SMTP próprio (ex.: Maddy) tem prioridade; Resend só se SMTP não estiver configurado
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(), // ex: noreply@sejavivasaude.com.br ou Viva Saúde <onboarding@resend.dev>
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // WhatsApp – esqueci senha: Evolution API (gratuito, open source) ou Twilio (pago)
  EVOLUTION_API_URL: z.string().url().optional(), // ex: https://sua-evolution.com ou http://localhost:8080
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
});

// Validar e exportar variáveis de ambiente
type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Erro na validação das variáveis de ambiente:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export default env;
