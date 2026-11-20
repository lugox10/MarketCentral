import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

import { CODE_PATTERN } from '../domain/taxonomy.js';
import { SLUG_PATTERN } from '../../../common/utils/slug.js';

const ATTRIBUTE_TYPE_VALUES = ['TEXT', 'NUMBER', 'BOOLEAN', 'ENUM'];

export class AddOptionDto {
  @ApiProperty({ type: String, example: '256GB', minLength: 1, maxLength: 60 })
  @IsString()
  @Length(1, 60)
  value!: string;
}

export class CreateVerticalDto {
  @ApiProperty({ type: String, example: 'Joyerías', minLength: 2, maxLength: 60 })
  @IsString()
  @Length(2, 60)
  name!: string;

  @ApiPropertyOptional({
    type: String,
    example: 'joyerias',
    description: 'Si no llega, se genera desde el nombre',
  })
  @IsOptional()
  @IsString()
  @Length(3, 60)
  @Matches(SLUG_PATTERN, { message: 'El slug debe estar en minúsculas y separado por guiones' })
  slug?: string;
}

export class CreateCategoryDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  verticalId!: string;

  @ApiProperty({ type: String, example: 'Tablets', minLength: 2, maxLength: 60 })
  @IsString()
  @Length(2, 60)
  name!: string;

  @ApiPropertyOptional({ type: String, example: 'tablets' })
  @IsOptional()
  @IsString()
  @Length(3, 60)
  @Matches(SLUG_PATTERN, { message: 'El slug debe estar en minúsculas y separado por guiones' })
  slug?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class CreateAttributeDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ type: String, example: 'Color', minLength: 2, maxLength: 60 })
  @IsString()
  @Length(2, 60)
  name!: string;

  @ApiProperty({ type: String, example: 'color' })
  @IsString()
  @Matches(CODE_PATTERN, { message: 'El code debe estar en minúsculas y separado por guiones' })
  code!: string;

  @ApiProperty({ type: String, enum: ATTRIBUTE_TYPE_VALUES, example: 'ENUM' })
  @IsIn(ATTRIBUTE_TYPE_VALUES, { message: 'type debe ser TEXT, NUMBER, BOOLEAN o ENUM' })
  type!: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'ENUM';

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['Negro', 'Blanco'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

/**
 * Edición desde el panel: todos los campos son opcionales, pero el caso de uso
 * rechaza un PATCH vacío. Nunca se puede cambiar el slug ni el code.
 */
export class UpdateVerticalDto {
  @ApiPropertyOptional({ type: String, minLength: 2, maxLength: 60 })
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'false la retira de los formularios' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ type: String, minLength: 2, maxLength: 60 })
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAttributeDto {
  @ApiPropertyOptional({ type: String, minLength: 2, maxLength: 60 })
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOptionDto {
  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 60 })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  value?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
