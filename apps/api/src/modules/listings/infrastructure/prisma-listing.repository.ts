import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service.js';
import { ListingError } from '../domain/listing-error.js';
import type { AttributeValue } from '../domain/attributes.js';
import type { ListingStatus } from '../domain/listing.js';
import type {
  AddImageInput,
  ArchivedImageRecord,
  CategoryContext,
  CreateListingInput,
  ListingFilters,
  ListingImageRecord,
  ListingListResult,
  ListingRecord,
  ListingRepository,
  UpdateListingInput,
} from '../application/ports.js';

const listingInclude = {
  category: { select: { id: true, name: true } },
  business: { select: { name: true } },
  images: { orderBy: { position: 'asc' } },
} satisfies Prisma.ListingInclude;

type ListingRow = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

interface ImageRow {
  id: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  position: number;
}

function toImage(row: ImageRow): ListingImageRecord {
  return {
    id: row.id,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    position: row.position,
    url: '',
  };
}

function toRecord(row: ListingRow): ListingRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    businessName: row.business.name,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    title: row.title,
    description: row.description,
    condition: row.condition,
    priceAmount: row.priceAmount,
    currency: row.currency,
    status: row.status,
    slug: row.slug,
    attributes: (row.attributes ?? {}) as Record<string, AttributeValue>,
    attributesSchemaVersion: row.attributesSchemaVersion,
    featured: row.featured,
    publishedAt: row.publishedAt,
    soldAt: row.soldAt,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    images: row.images.map(toImage),
  };
}

@Injectable()
export class PrismaListingRepository implements ListingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCategoryContext(categoryId: string): Promise<CategoryContext | null> {
    const row = await this.prisma.category.findUnique({
      where: { id: categoryId },
      // Solo atributos y opciones activos: los retirados desde el panel no se
      // piden en publicaciones nuevas, pero siguen guardados en las antiguas.
      include: {
        attributes: {
          where: { isActive: true },
          include: { options: { where: { isActive: true } } },
        },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      verticalId: row.verticalId,
      businessId: row.businessId,
      name: row.name,
      isActive: row.isActive,
      definitions: row.attributes.map((definition) => ({
        code: definition.code,
        name: definition.name,
        type: definition.type,
        isRequired: definition.isRequired,
        options: definition.options.map((option) => option.value),
      })),
    };
  }

  async findById(listingId: string): Promise<ListingRecord | null> {
    const row = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: listingInclude,
    });
    return row ? toRecord(row) : null;
  }

  async listByBusiness(businessId: string, filters: ListingFilters): Promise<ListingListResult> {
    const where: Prisma.ListingWhereInput = { businessId };
    if (filters.status) where.status = filters.status;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        include: listingInclude,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return { items: rows.map(toRecord), total };
  }

  async countByBusiness(businessId: string): Promise<number> {
    return this.prisma.listing.count({ where: { businessId, status: { not: 'ARCHIVED' } } });
  }

  async countFeatured(businessId: string): Promise<number> {
    return this.prisma.listing.count({
      where: { businessId, featured: true, status: { in: ['DRAFT', 'PUBLISHED', 'SOLD'] } },
    });
  }

  async create(input: CreateListingInput): Promise<ListingRecord> {
    const row = await this.prisma.listing.create({
      data: {
        businessId: input.businessId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        condition: input.condition,
        priceAmount: input.priceAmount,
        currency: input.currency,
        attributes: input.attributes,
        slug: input.slug,
        status: 'DRAFT',
      },
      include: listingInclude,
    });
    return toRecord(row);
  }

  async update(listingId: string, input: UpdateListingInput): Promise<ListingRecord> {
    const row = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.condition !== undefined ? { condition: input.condition } : {}),
        ...(input.priceAmount !== undefined ? { priceAmount: input.priceAmount } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
      },
      include: listingInclude,
    });
    return toRecord(row);
  }

  async setStatus(
    listingId: string,
    status: ListingStatus,
    timestamps: { publishedAt?: Date; soldAt?: Date; archivedAt?: Date },
  ): Promise<ListingRecord> {
    const row = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status,
        ...(timestamps.publishedAt ? { publishedAt: timestamps.publishedAt } : {}),
        ...(timestamps.soldAt ? { soldAt: timestamps.soldAt } : {}),
        ...(timestamps.archivedAt ? { archivedAt: timestamps.archivedAt } : {}),
        ...(status === 'ARCHIVED' ? { featured: false, featuredAt: null } : {}),
        ...(status === 'SOLD' ? { featured: false, featuredAt: null } : {}),
      },
      include: listingInclude,
    });
    return toRecord(row);
  }

  async setFeatured(listingId: string, featured: boolean, at: Date | null): Promise<ListingRecord> {
    const row = await this.prisma.listing.update({
      where: { id: listingId },
      data: { featured, featuredAt: at },
      include: listingInclude,
    });
    return toRecord(row);
  }

  async slugExists(businessId: string, slug: string): Promise<boolean> {
    const row = await this.prisma.listing.findFirst({
      where: { businessId, slug },
      select: { id: true },
    });
    return row !== null;
  }

  async listImages(listingId: string): Promise<ListingImageRecord[]> {
    const rows = await this.prisma.listingImage.findMany({
      where: { listingId },
      orderBy: { position: 'asc' },
    });
    return rows.map((row) => toImage(row));
  }

  async addImage(input: AddImageInput): Promise<ListingImageRecord> {
    const row = await this.prisma.listingImage.create({
      data: {
        listingId: input.listingId,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        width: input.width,
        height: input.height,
        position: input.position,
      },
    });
    return toImage(row);
  }

  async findImage(listingId: string, imageId: string): Promise<ListingImageRecord | null> {
    const row = await this.prisma.listingImage.findFirst({ where: { id: imageId, listingId } });
    return row ? toImage(row) : null;
  }

  async removeImage(listingId: string, imageId: string): Promise<void> {
    await this.prisma.listingImage.deleteMany({ where: { id: imageId, listingId } });
  }

  async reorderImages(listingId: string, orderedIds: string[]): Promise<ListingRecord> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.listingImage.findMany({ where: { listingId } });
      const byId = new Map(rows.map((row) => [row.id, row]));

      // El índice único (listing_id, position) no es diferible: se reemplazan las
      // filas dentro de la transacción conservando id y clave de objeto.
      await tx.listingImage.deleteMany({ where: { listingId } });
      await tx.listingImage.createMany({
        data: orderedIds.map((imageId, index) => {
          const row = byId.get(imageId);
          if (!row) {
            throw new ListingError('IMAGE_NOT_FOUND', 'La imagen no existe en la publicación');
          }

          return {
            id: row.id,
            listingId,
            storageKey: row.storageKey,
            mimeType: row.mimeType,
            sizeBytes: row.sizeBytes,
            width: row.width,
            height: row.height,
            position: index,
            createdAt: row.createdAt,
          };
        }),
      });
    });

    const row = await this.prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
      include: listingInclude,
    });
    return toRecord(row);
  }

  /**
   * Imágenes de publicaciones archivadas antes de cutoff, para la purga
   * periódica. Nunca toca borradores, publicadas ni vendidas: esas conservan
   * sus fotos aunque la suscripción haya vencido.
   */
  async listArchivedImagesBefore(cutoff: Date, limit: number): Promise<ArchivedImageRecord[]> {
    return this.prisma.listingImage.findMany({
      where: { listing: { status: 'ARCHIVED', archivedAt: { lt: cutoff } } },
      select: { id: true, listingId: true, storageKey: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async deleteImages(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.listingImage.deleteMany({ where: { id: { in: ids } } });
  }
}
