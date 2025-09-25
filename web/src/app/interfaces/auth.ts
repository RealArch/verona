export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  admin: boolean;
  emailVerified: boolean;
  isActive: boolean;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}