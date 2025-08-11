export interface IUser {
  id: string;
  email: string;
  displayName?: string;
  preferences?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserService {
  findById(id: string): Promise<IUser | null>;
  findByEmail(email: string): Promise<IUser | null>;
  create(userData: Partial<IUser>): Promise<IUser>;
  update(id: string, userData: Partial<IUser>): Promise<IUser>;
}
