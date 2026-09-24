export type UserStatus = "PENDING" | "APPROVED" | "REJECTED" | "LOCKED";

export type RoleName =
  "HEAD_TRAINER" | "VETERINARIAN" | "GROOM" | "HORSE_OWNER" | "CLUB_MANAGER";

export type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  roleName: RoleName;
  status: UserStatus;
  approvedAt?: string | null;
  createdAt: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};
