import { ApiProperty } from '@nestjs/swagger';

import type {
  AttributeOptionRecord,
  AttributeRecord,
  CategoryRecord,
  VerticalRecord,
} from './ports.js';

export class AttributeOptionResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  value!: string;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;
}

export class AttributeResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  categoryId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String, enum: ['TEXT', 'NUMBER', 'BOOLEAN', 'ENUM'] })
  type!: string;

  @ApiProperty({ type: Boolean })
  isRequired!: boolean;

  @ApiProperty({ type: Boolean })
  isFilterable!: boolean;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: [AttributeOptionResponseDto] })
  options!: AttributeOptionResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class CategoryResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  verticalId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class VerticalResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class VerticalListResponseDto {
  @ApiProperty({ type: [VerticalResponseDto] })
  items!: VerticalResponseDto[];
}

export class CategoryListResponseDto {
  @ApiProperty({ type: String })
  verticalId!: string;

  @ApiProperty({ type: [CategoryResponseDto] })
  items!: CategoryResponseDto[];
}

export class AttributeListResponseDto {
  @ApiProperty({ type: String })
  categoryId!: string;

  @ApiProperty({ type: [AttributeResponseDto] })
  items!: AttributeResponseDto[];
}

export function toOption(record: AttributeOptionRecord): AttributeOptionResponseDto {
  return { id: record.id, value: record.value, isActive: record.isActive };
}

export function toAttributeResponse(record: AttributeRecord): AttributeResponseDto {
  return {
    id: record.id,
    categoryId: record.categoryId,
    name: record.name,
    code: record.code,
    type: record.type,
    isRequired: record.isRequired,
    isFilterable: record.isFilterable,
    isActive: record.isActive,
    options: record.options.map(toOption),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toCategoryResponse(record: CategoryRecord): CategoryResponseDto {
  return {
    id: record.id,
    verticalId: record.verticalId,
    name: record.name,
    slug: record.slug,
    parentId: record.parentId,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toVerticalResponse(record: VerticalRecord): VerticalResponseDto {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
