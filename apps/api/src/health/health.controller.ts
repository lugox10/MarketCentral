import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

export type HealthResponse = {
  status: 'ok';
  timestamp: string;
  uptime: number;
};

@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * Liveness mínimo. No toca base de datos ni dependencias externas:
   * responde con datos no sensibles del proceso.
   */
  @Get()
  @ApiOperation({ summary: 'Estado del proceso de la API' })
  @ApiOkResponse({
    description: 'La API está viva',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', example: 12 },
      },
      required: ['status', 'timestamp', 'uptime'],
    },
  })
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    };
  }
}
