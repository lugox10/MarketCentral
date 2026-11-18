import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { BusinessCategory, CategoryParentOption } from './ports.js';

export class BusinessCategoryResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class CategoryParentOptionDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ type: Boolean, description: 'true si la categoría es propia del negocio' })
  isOwn!: boolean;
}

export class BusinessCategoryListResponseDto {
  @ApiProperty({ type: [BusinessCategoryResponseDto] })
  items!: BusinessCategoryResponseDto[];

  @ApiProperty({ type: Number, description: 'Categorías propias activas' })
  used!: number;

  @ApiProperty({ type: Number, description: 'Cupo del plan vigente' })
  limit!: number;

  @ApiProperty({ type: Number })
  remaining!: number;

  @ApiProperty({ type: Boolean })
  canCreate!: boolean;

  @ApiProperty({ type: String })
  planCode!: string;

  @ApiProperty({ type: String, description: 'Mensaje de mejora cuando la cuota es 0' })
  upgradeHint!: string;
}

export class BusinessCategoryDetailResponseDto {
  @ApiProperty({ type: BusinessCategoryResponseDto })
  category!: BusinessCategoryResponseDto;

  @ApiProperty({ type: [CategoryParentOptionDto] })
  parentOptions!: CategoryParentOptionDto[];
}

export function toCategoryResponse(category: BusinessCategory): BusinessCategoryResponseDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
  };
}

export function toParentOption(option: CategoryParentOption): CategoryParentOptionDto {
  return { id: option.id, name: option.name, slug: option.slug, isOwn: option.isOwn };
}
