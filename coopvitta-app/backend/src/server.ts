import 'dotenv/config';
import type { Server } from 'http';
import type { Socket } from 'net';
import { createApp } from './app';
import env from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { markShuttingDown } from './config/shutdown';
import { startEmailQueue, stopEmailQueue } from './jobs/email-queue';
import { safeLogger } from './utils/safe-logger';

const PORT = parseInt(env.PORT) || 3001;
const activeConnections = new Set<Socket>();

function connectDatabaseInBackground() {
  connectDatabase().catch((err) => {
    safeLogger.error('Conexão ao banco em background falhou:', err?.message ?? err);
    console.log('⏳ O servidor está no ar; novas tentativas a cada 30s...');
    setTimeout(connectDatabaseInBackground, 30000);
  });
}

function trackConnections(server: Server) {
  server.on('connection', (socket) => {
    activeConnections.add(socket);
    socket.on('close', () => activeConnections.delete(socket));
  });
}

function closeActiveConnections() {
  for (const socket of activeConnections) {
    socket.destroy();
  }
  activeConnections.clear();
}

function startServer() {
  try {
    const app = createApp();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📝 Ambiente: ${env.NODE_ENV}`);
      console.log(`🌐 Escutando em 0.0.0.0 (necessário para Render)`);
      connectDatabaseInBackground();
      void connectRedis().then((ok) => {
        if (ok) startEmailQueue();
      });
    });

    trackConnections(server);

    const shutdown = async (signal: string) => {
      markShuttingDown();
      safeLogger.info(`Recebido ${signal}; encerrando graciosamente...`);

      server.close(async () => {
        safeLogger.info('Servidor HTTP encerrado (sem novas conexões)');
        await stopEmailQueue();
        await disconnectRedis();
        await disconnectDatabase();
        process.exit(0);
      });

      setTimeout(() => {
        safeLogger.warn('Timeout de shutdown; fechando conexões ativas...');
        closeActiveConnections();
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    safeLogger.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
