import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d).+$/;

const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ type: String, example: 'dueno@prenderia.com' })
  @Transform(lower)
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(320)
  email!: string;

  @ApiProperty({ type: String, example: 'ClaveSegura1' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128)
  @Matches(PASSWORD_RULE, {
    message: 'La contraseña debe incluir al menos una mayúscula y un número',
  })
  password!: string;

  @ApiProperty({ type: String, example: 'Ana Pérez' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

export class LoginDto {
  @ApiProperty({ type: String, example: 'dueno@prenderia.com' })
  @Transform(lower)
  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string;

  @ApiProperty({ type: String, example: 'ClaveSegura1' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class TokenDto {
  @ApiProperty({ type: String, description: 'Token opaco recibido por correo' })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;
}

export class EmailOnlyDto {
  @ApiProperty({ type: String, example: 'dueno@prenderia.com' })
  @Transform(lower)
  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string;
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty({ type: String, example: 'NuevaClave1' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128)
  @Matches(PASSWORD_RULE, {
    message: 'La contraseña debe incluir al menos una mayúscula y un número',
  })
  password!: string;
}
