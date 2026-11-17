import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/** Un único cliente de PostgreSQL por proceso (API y jobs del mismo monolito). */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
