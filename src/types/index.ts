import type { Role } from "@prisma/client";

export type { Role };

export type NavItem = {
  title: string;
  href: string;
  icon?: string;
  roles?: Role[];
};
