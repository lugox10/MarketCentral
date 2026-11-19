import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  BUSINESS_SETTABLE_STATUSES,
  LEAD_EMAIL_MAX,
  LEAD_MESSAGE_MAX,
  LEAD_MESSAGE_MIN,
  LEAD_NAME_MAX,
  LEAD_NAME_MIN,
  LEAD_PHONE_MAX,
  LEAD_STATUSES,
} from '../domain/lead.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreatePublicLeadDto {
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'businessSlug no es un slug válido' })
  businessSlug!: string;

  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'listingSlug no es un slug válido' })
  listingSlug?: string;

  @IsString()
  @Length(LEAD_NAME_MIN, LEAD_NAME_MAX, {
    message: `El nombre debe tener entre ${LEAD_NAME_MIN} y ${LEAD_NAME_MAX} caracteres`,
  })
  buyerName!: string;

  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(LEAD_EMAIL_MAX)
  buyerEmail!: string;

  @IsString()
  @Length(7, LEAD_PHONE_MAX, { message: 'El teléfono no tiene un formato válido' })
  buyerPhone!: string;

  @IsString()
  @Length(LEAD_MESSAGE_MIN, LEAD_MESSAGE_MAX, {
    message: `El mensaje debe tener entre ${LEAD_MESSAGE_MIN} y ${LEAD_MESSAGE_MAX} caracteres`,
  })
  message!: string;

  @IsBoolean({ message: 'Debes autorizar el contacto con el negocio' })
  consent!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsString()
  @Length(10, 200, {
    message: 'El formulario no es válido. Recarga la página e inténtalo de nuevo',
  })
  formToken!: string;
}

export class ListLeadsQueryDto {
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: (typeof LEAD_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number;
}

export class UpdateLeadStatusDto {
  @IsIn(BUSINESS_SETTABLE_STATUSES, {
    message: 'Solo puedes marcar el mensaje como respondido, archivado o spam',
  })
  status!: (typeof BUSINESS_SETTABLE_STATUSES)[number];
}
