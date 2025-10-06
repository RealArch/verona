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
  addresses: UserAddress[];
}
export interface UserAddress {
  id: string;
  name: string;
  address_1: string;
  address_2: string | null;
  description: string;
  municipality: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
}
