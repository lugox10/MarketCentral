import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClientPkg from '@prisma/client';

/**
 * `@prisma/client` se publica como CommonJS y el import con nombre solo resuelve
 * en Node 24; con el import por defecto el interop funciona igual en Node 22.12+
 * y en Node 24 (ambas versiones admiten Prisma 7, ver docs/21).
 *
 * Único punto de acceso a PostgreSQL: adaptador `pg` y cadena `DATABASE_URL`.
 */
const BasePrismaClient = prismaClientPkg.PrismaClient;

@Injectable()
export class PrismaService extends BasePrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL no está definida: no se puede inicializar Prisma');
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    // La conexión es diferida: no bloquea el arranque si la base está caída.
    this.logger.log('PrismaClient inicializado (pool perezoso)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
