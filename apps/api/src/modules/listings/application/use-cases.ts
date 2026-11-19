import { Inject, Injectable } from '@nestjs/common';

import type { BusinessCategoryRepository } from '../../businesses/application/ports.js';
import {
  BUSINESS_CATEGORY_REPOSITORY,
  BUSINESS_REPOSITORY,
} from '../../businesses/application/tokens.js';
import type { BusinessContext, BusinessRepository } from '../../businesses/application/ports.js';
import { slugify } from '../../../common/utils/slug.js';
import { validateAttributes } from '../domain/attributes.js';
import { ListingError } from '../domain/listing-error.js';
import {
  DEFAULT_CURRENCY,
  MAX_IMAGES,
  MIN_PUBLISH_IMAGES,
  canTransition,
  isEditable,
  isValidDescription,
  isValidPrice,
  isValidTitle,
  normalizeDescription,
  normalizeTitle,
  slugSuffix,
  type ListingCondition,
  type ListingCurrency,
  type ListingStatus,
} from '../domain/listing.js';
import { LISTING_REPOSITORY, MEDIA_STORAGE } from './tokens.js';
import type {
  CategoryContext,
  ListingImageRecord,
  ListingRecord,
  ListingRepository,
  MediaStorage,
  UpdateListingInput,
} from './ports.js';
import { inspectImage, extensionFor } from '../../../common/media/image-inspector.js';

@Injectable()
export class ListingsSupport {
  constructor(
    @Inject(BUSINESS_REPOSITORY) readonly businesses: BusinessRepository,
    @Inject(BUSINESS_CATEGORY_REPOSITORY) readonly categories: BusinessCategoryRepository,
  ) {}

  async requireBusiness(userId: string): Promise<BusinessContext> {
    const context = await this.businesses.findByUserId(userId);
    if (!context) {
      throw new ListingError('BUSINESS_NOT_FOUND', 'Todavía no tienes un negocio');
    }
    return context;
  }
}

@Injectable()
export class CreateListingUseCase {
  constructor(
    @Inject(LISTING_REPOSITORY) private readonly listings: ListingRepository,
    @Inject(ListingsSupport) private readonly support: ListingsSupport,
  ) {}

  async execute(input: {
    userId: string;
    categoryId: string;
    title: string;
    description: string;
    condition: ListingCondition;
    priceAmount: number;
    currency?: ListingCurrency;
    attributes?: Record<string, unknown>;
  }): Promise<ListingRecord> {
    const context = await this.support.requireBusiness(input.userId);
    const business = context.business;

    const category = await this.requireCategory(input.categoryId, business.verticalId, business.id);
    const attributes = validateAttributes(category.definitions, input.attributes);

    const title = normalizeTitle(input.title);
    if (!isValidTitle(title)) {
      throw new ListingError('INVALID_TITLE', 'El título debe tener entre 5 y 120 caracteres');
    }
    const description = normalizeDescription(input.description);
    if (!isValidDescription(description)) {
      throw new ListingError(
        'INVALID_DESCRIPTION',
        'La descripción debe tener entre 20 y 4000 caracteres',
      );
    }
    if (!isValidPrice(input.priceAmount)) {
      throw new ListingError(
        'INVALID_PRICE',
        'El precio debe ser un entero entre 0 y 1.000.000.000',
      );
    }

    const maxListings = context.subscription?.plan.maxListings ?? 0;
    const used = await this.listings.countByBusiness(business.id);
    if (used >= maxListings) {
      throw new ListingError(
        'LISTING_LIMIT_REACHED',
        `Tu plan permite ${maxListings} publicaciones; archiva una o mejora el plan`,
      );
    }

    const base = slugify(title).slice(0, 70);
    let slug = `${base}-${slugSuffix(`${business.id}:${Date.now()}`)}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (!(await this.listings.slugExists(business.id, slug))) break;
      slug = `${base}-${slugSuffix(`${business.id}:${Date.now()}:${attempt}`)}`;
      if (attempt === 4)
        throw new ListingError('SLUG_EXHAUSTED', 'No pudimos generar un enlace único');
    }

    return this.listings.create({
      businessId: business.id,
      categoryId: category.id,
      title,
      description,
      condition: input.condition,
      priceAmount: input.priceAmount,
      currency: input.currency ?? DEFAULT_CURRENCY,
      attributes,
      slug,
    });
  }

  private async requireCategory(
    categoryId: string,
    verticalId: string,
    businessId: string,
  ): Promise<CategoryContext> {
    const category = await this.listings.findCategoryContext(categoryId);
    if (!category) {
      throw new ListingError('CATEGORY_NOT_FOUND', 'La categoría no existe');
    }
    if (category.verticalId !== verticalId) {
      throw new ListingError('CATEGORY_NOT_IN_VERTICAL', 'La categoría pertenece a otra vertical');
    }
    if (!category.isActive) {
      throw new ListingError('CATEGORY_NOT_AVAILABLE', 'La categoría está inactiva');
    }
    if (category.businessId !== null && category.businessId !== businessId) {
      throw new ListingError(
        'CATEGORY_NOT_AVAILABLE',
        'Esa categoría propia pertenece a otro negocio',
      );
    }
    return category;
  }
}

@Injectable()
export class UpdateListingUseCase {
  constructor(
    @Inject(LISTING_REPOSITORY) private readonly listings: ListingRepository,
    @Inject(ListingsSupport) private readonly support: ListingsSupport,
  ) {}

  async execute(input: {
    userId: string;
    listingId: string;
    categoryId?: string;
    title?: string;
    description?: string;
    condition?: ListingCondition;
    priceAmount?: number;
    currency?: ListingCurrency;
    attributes?: Record<string, unknown>;
  }): Promise<ListingRecord> {
    const context = await this.support.requireBusiness(input.userId);
    const listing = await this.requireOwned(input.listingId, context.business.id);
    if (!isEditable(listing.status)) {
      throw new ListingError('LISTING_LOCKED', 'Esta publicación ya no se puede editar');
    }

    const patch: UpdateListingInput = {};

    if (input.title !== undefined) {
      const title = normalizeTitle(input.title);
      if (!isValidTitle(title)) {
        throw new ListingError('INVALID_TITLE', 'El título debe tener entre 5 y 120 caracteres');
      }
      patch.title = title;
    }
    if (input.description !== undefined) {
      const description = normalizeDescription(input.description);
      if (!isValidDescription(description)) {
        throw new ListingError(
          'INVALID_DESCRIPTION',
          'La descripción debe tener entre 20 y 4000 caracteres',
        );
      }
      patch.description = description;
    }
    if (input.priceAmount !== undefined) {
      if (!isValidPrice(input.priceAmount)) {
        throw new ListingError(
          'INVALID_PRICE',
          'El precio debe ser un entero entre 0 y 1.000.000.000',
        );
      }
      patch.priceAmount = input.priceAmount;
    }
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.condition !== undefined) patch.condition = input.condition;

    if (input.categoryId !== undefined && input.categoryId !== listing.categoryId) {
      const category = await this.listings.findCategoryContext(input.categoryId);
      if (!category || category.verticalId !== context.business.verticalId) {
        throw new ListingError(
          'CATEGORY_NOT_IN_VERTICAL',
          'La categoría pertenece a otra vertical',
        );
      }
      if (!category.isActive)
        throw new ListingError('CATEGORY_NOT_AVAILABLE', 'La categoría está inactiva');
      if (category.businessId !== null && category.businessId !== context.business.id) {
        throw new ListingError('CATEGORY_NOT_AVAILABLE', 'Esa categoría pertenece a otro negocio');
      }
      patch.categoryId = category.id;
      if (input.attributes === undefined) {
        throw new ListingError(
          'INVALID_INPUT',
          'Al cambiar de categoría debes enviar los atributos de la nueva categoría',
        );
      }
      patch.attributes = validateAttributes(category.definitions, input.attributes);
    } else if (input.attributes !== undefined) {
      const category = await this.listings.findCategoryContext(listing.categoryId);
      patch.attributes = validateAttributes(category?.definitions ?? [], input.attributes);
    }

    return this.listings.update(listing.id, patch);
  }

  private async requireOwned(listingId: string, businessId: string): Promise<ListingRecord> {
    const listing = await this.listings.findById(listingId);
    if (!listing) throw new ListingError('LISTING_NOT_FOUND', 'La publicación no existe');
    if (listing.businessId !== businessId) {
      throw new ListingError('LISTING_NOT_OWNED', 'La publicación pertenece a otro negocio');
    }
    return listing;
  }
}

@Injectable()
export class ChangeListingStatusUseCase {
  constructor(
    @Inject(LISTING_REPOSITORY) private readonly listings: ListingRepository,
    @Inject(ListingsSupport) private readonly support: ListingsSupport,
  ) {}

  async execute(input: {
    userId: string;
    listingId: string;
    to: ListingStatus;
  }): Promise<ListingRecord> {
    const context = await this.support.requireBusiness(input.userId);
    const listing = await this.listings.findById(input.listingId);
    if (!listing) throw new ListingError('LISTING_NOT_FOUND', 'La publicación no existe');
    if (listing.businessId !== context.business.id) {
      throw new ListingError('LISTING_NOT_OWNED', 'La publicación pertenece a otro negocio');
    }
    if (!canTransition(listing.status, input.to)) {
      throw new ListingError(
        'INVALID_STATUS_TRANSITION',
        `No se puede pasar de ${listing.status} a ${input.to}`,
      );
    }

    if (input.to === 'PUBLISHED') {
      if (listing.images.length < MIN_PUBLISH_IMAGES) {
        throw new ListingError(
          'IMAGES_REQUIRED',
          MIN_PUBLISH_IMAGES === 1
            ? 'Sube al menos una foto antes de publicar'
            : `Sube mínimo ${MIN_PUBLISH_IMAGES} fotos antes de publicar`,
        );
      }
      const maxListings = context.subscription?.plan.maxListings ?? 0;
      const used = await this.listings.countByBusiness(context.business.id);
      if (used > maxListings) {
        throw new ListingError(
          'LISTING_LIMIT_REACHED',
          `Tu plan permite ${maxListings} publicaciones`,
        );
      }
      return this.listings.setStatus(listing.id, 'PUBLISHED', { publishedAt: new Date() });
    }

    if (input.to === 'SOLD') {
      return this.listings.setStatus(listing.id, 'SOLD', { soldAt: new Date() });
    }

    return this.listings.setStatus(listing.id, 'ARCHIVED', { archivedAt: new Date() });
  }
}

@Injectable()
export class ToggleFeaturedUseCase {
  constructor(
    @Inject(LISTING_REPOSITORY) private readonly listings: ListingRepository,
    @Inject(ListingsSupport) private readonly support: ListingsSupport,
  ) {}

  async execute(input: {
    userId: string;
    listingId: string;
    featured: boolean;
  }): Promise<ListingRecord> {
    const context = await this.support.requireBusiness(input.userId);
    const listing = await this.listings.findById(input.listingId);
    if (!listing) throw new ListingError('LISTING_NOT_FOUND', 'La publicación no existe');
    if (listing.businessId !== context.business.id) {
      throw new ListingError('LISTING_NOT_OWNED', 'La publicación pertenece a otro negocio');
    }
    if (listing.status === 'ARCHIVED') {
      throw new ListingError('LISTING_LOCKED', 'Una publicación archivada no se puede destacar');
    }
    if (input.featured && !listing.featured) {
      const slots = context.subscription?.plan.featuredSlots ?? 0;
      const used = await this.listings.countFeatured(context.business.id);
      if (used >= slots) {
        throw new ListingError(
          'FEATURED_LIMIT_REACHED',
          `Tu plan permite ${slots} destacados simultáneos`,
        );
      }
    }
    return this.listings.setFeatured(
      listing.id,
      input.featured,
      input.featured ? new Date() : null,
    );
  }
}

@Injectable()
export class AddListingImageUseCase {
  constructor(
    @Inject(LISTING_REPOSITORY) private readonly listings: ListingRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    @Inject(ListingsSupport) private readonly support: ListingsSupport,
  ) {}

  async execute(input: {
    userId: string;
    listingId: string;
    buffer: Buffer;
    sizeBytes: number;
    declaredMimeType?: string;
  }): Promise<ListingImageRecord> {
    const context = await this.support.requireBusiness(input.userId);
    const listing = await this.listings.findById(input.listingId);
    if (!listing) throw new ListingError('LISTING_NOT_FOUND', 'La publicación no existe');
    if (listing.businessId !== context.business.id) {
      throw new ListingError('LISTING_NOT_OWNED', 'La publicación pertenece a otro negocio');
    }
    if (!isEditable(listing.status)) {
      throw new ListingError('LISTING_LOCKED', 'Esta publicación ya no admite imágenes');
    }
    if (listing.images.length >= MAX_IMAGES) {
      throw new ListingError(
        'IMAGE_LIMIT_REACHED',
        `Máximo ${MAX_IMAGES} imágenes por publicación`,
      );
    }

    const info = inspectImage(input.buffer);
    if (!info) {
      throw new ListingError(
        'INVALID_IMAGE_TYPE',
        'El archivo debe ser una imagen JPEG, PNG o WebP válida',
      );
    }

    const key = `listings/${listing.businessId}/${listing.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${extensionFor(info.mimeType)}`;
    await this.storage.put(key, input.buffer, info.mimeType);

    const image = await this.listings.addImage({
      listingId: listing.id,
      storageKey: key,
      mimeType: info.mimeType,
      sizeBytes: input.sizeBytes,
      width: info.width,
      height: info.height,
      position: listing.images.length,
    });

    return { ...image, url: this.storage.publicUrl(image.storageKey) };
  }
}

@Injectable()
export class RemoveListingImageUseCase {
  constructor(
    @Inject(LISTING_REPOSITORY) private readonly listings: ListingRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    @Inject(ListingsSupport) private readonly support: ListingsSupport,
  ) {}

  async execute(input: { userId: string; listingId: string; imageId: string }): Promise<void> {
    const context = await this.support.requireBusiness(input.userId);
    const listing = await this.listings.findById(input.listingId);
    if (!listing) throw new ListingError('LISTING_NOT_FOUND', 'La publicación no existe');
    if (listing.businessId !== context.business.id) {
      throw new ListingError('LISTING_NOT_OWNED', 'La publicación pertenece a otro negocio');
    }
    const image = await this.listings.findImage(listing.id, input.imageId);
    if (!image) throw new ListingError('IMAGE_NOT_FOUND', 'La imagen no existe');

    await this.listings.removeImage(listing.id, image.id);
    await this.storage.delete(image.storageKey);

    const remaining = (await this.listings.listImages(listing.id)).map((item) => item.id);
    if (remaining.length > 0) {
      await this.listings.reorderImages(listing.id, remaining);
    }
  }
}

@Injectable()
export class ReorderListingImagesUseCase {
  constructor(
    @Inject(LISTING_REPOSITORY) private readonly listings: ListingRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    @Inject(ListingsSupport) private readonly support: ListingsSupport,
  ) {}

  async execute(input: {
    userId: string;
    listingId: string;
    imageIds: string[];
  }): Promise<ListingImageRecord[]> {
    const context = await this.support.requireBusiness(input.userId);
    const listing = await this.listings.findById(input.listingId);
    if (!listing) throw new ListingError('LISTING_NOT_FOUND', 'La publicación no existe');
    if (listing.businessId !== context.business.id) {
      throw new ListingError('LISTING_NOT_OWNED', 'La publicación pertenece a otro negocio');
    }
    const current = new Set(listing.images.map((image) => image.id));
    if (input.imageIds.length !== current.size || input.imageIds.some((id) => !current.has(id))) {
      throw new ListingError(
        'INVALID_INPUT',
        'El orden debe incluir todas las imágenes de la publicación',
      );
    }
    const updated = await this.listings.reorderImages(listing.id, input.imageIds);
    return updated.images.map((image) => ({
      ...image,
      url: this.storage.publicUrl(image.storageKey),
    }));
  }
}
