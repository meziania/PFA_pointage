import type { Role, LeaveType, LeaveStatus, AttendanceMethod, AttendanceDayStatus } from "@prisma/client";

export type { Role, LeaveType, LeaveStatus, AttendanceMethod, AttendanceDayStatus };

export type NavItem = {
  title: string;
  href: string;
  icon?: string;
  roles?: Role[];
};
