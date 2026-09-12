import type { Role } from "./types";

export type NavItem = {
  href: string;
  label: string;
  badgeKey?: "transfers" | "notifications";
};

export function navFor(role: Role): NavItem[] {
  // admin + branch_manager (the repair role has been removed)
  const items: NavItem[] = [
    { href: "/", label: "Home" },
    { href: "/rooms", label: "Rooms" },
    { href: "/assets", label: "Assets" },
    { href: "/move", label: "Move" },
    { href: "/approvals", label: "Approvals", badgeKey: "transfers" },
    { href: "/service", label: "Service & repairs" },
    { href: "/bills", label: "Bills" },
    { href: "/notifications", label: "Notifications", badgeKey: "notifications" },
  ];
  if (role === "admin") {
    items.push({ href: "/audit", label: "Audit trail" });
    items.push({ href: "/users", label: "People" });
  }
  return items;
}
