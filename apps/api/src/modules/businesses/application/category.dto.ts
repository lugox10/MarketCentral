import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const NAME_MIN = 2;
const NAME_MAX = 60;

export class CreateBusinessCategoryDto {
  @ApiProperty({ example: 'Celulares gama media', minLength: NAME_MIN, maxLength: NAME_MAX })
  @IsString()
  @MinLength(NAME_MIN)
  @MaxLength(NAME_MAX)
  name!: string;

  @ApiPropertyOptional({
    description: 'Categoría padre: global de la vertical o propia del negocio',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class UpdateBusinessCategoryDto {
  @ApiPropertyOptional({ minLength: NAME_MIN, maxLength: NAME_MAX })
  @IsOptional()
  @IsString()
  @MinLength(NAME_MIN)
  @MaxLength(NAME_MAX)
  name?: string;

  @ApiPropertyOptional({ description: 'Activar o desactivar la categoría propia' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
