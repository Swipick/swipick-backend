export class CreateUserDto {
  email!: string;
  displayName?: string;
  preferences?: Record<string, any>;
}

export class UpdateUserDto {
  displayName?: string;
  preferences?: Record<string, any>;
}

export class UserResponseDto {
  id!: string;
  email!: string;
  displayName?: string;
  createdAt!: Date;
  updatedAt!: Date;
}
