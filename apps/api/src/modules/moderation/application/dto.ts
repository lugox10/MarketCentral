import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  ACTION_REASON_MAX,
  DETAILS_MAX,
  NOTE_MAX,
  REPORT_REASONS,
  REPORT_STATUSES,
  type ReportReason,
  type ReportStatus,
} from '../domain/report.js';

/** Denuncia ciudadana. `website` es el honeypot: si llega con valor se ignora. */
export class CreatePublicReportDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  businessSlug?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(90)
  listingSlug?: string;

  @IsIn([...REPORT_REASONS])
  reason!: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(DETAILS_MAX)
  details?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  reporterEmail?: string;

  /** Honeypot: los humanos no lo ven ni lo rellenan. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class ListReportsQueryDto {
  @IsOptional()
  @IsIn([...REPORT_STATUSES])
  status?: ReportStatus;

  @IsOptional()
  @IsIn([...REPORT_REASONS])
  reason?: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class UpdateReportStatusDto {
  @IsIn([...REPORT_STATUSES])
  status!: ReportStatus;

  @IsOptional()
  @IsString()
  @Length(5, NOTE_MAX)
  note?: string;
}

export class SuspendBusinessDto {
  @IsString()
  @Length(5, ACTION_REASON_MAX)
  reason!: string;
}

export class ArchiveListingDto {
  @IsOptional()
  @IsString()
  @Length(5, ACTION_REASON_MAX)
  reason?: string;

  @IsOptional()
  @IsUUID('all')
  reportId?: string;
}
