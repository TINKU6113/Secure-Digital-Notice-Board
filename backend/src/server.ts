import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

async function bootstrap() {
  try {
    // 1. Verify Database Connectivity on startup
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    client.release();

    console.log('✅ PostgreSQL connected successfully:');
    console.log(`   Database: ${env.DB_NAME} on ${env.DB_HOST}:${env.DB_PORT}`);
    console.log(`   DB Time:  ${result.rows[0].current_time}`);

    // 2. Start HTTP Listener
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Secure Digital Notice Board API listening on port ${env.PORT}`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(`   Healthcheck: http://localhost:${env.PORT}/api/health`);
    });

    // 3. Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        console.log('   HTTP server closed.');
        await pool.end();
        console.log('   PostgreSQL pool closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start application server:', error);
    process.exit(1);
  }
}

bootstrap();
