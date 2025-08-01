export class LoginDto {
  email!: string;
  password!: string;
}

export class VerifyTokenDto {
  token!: string;
}

export class AuthResponseDto {
  token!: string;
  user!: {
    id: string;
    email: string;
    displayName?: string;
  };
}
