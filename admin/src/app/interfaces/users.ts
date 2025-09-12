export interface Users {
}


export interface AdminUser {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  createdAt: Date | string | number;
}