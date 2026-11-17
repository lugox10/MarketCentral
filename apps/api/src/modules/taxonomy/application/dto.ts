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
