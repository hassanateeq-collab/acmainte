import type { Role } from "./types";

export type NavItem = {
  href: string;
  label: string;
  badgeKey?: "transfers" | "notifications";
};

export function navFor(role: Role): NavItem[] {
  if (role === "repair") {
    return [
      { href: "/", label: "Home" },
      { href: "/service", label: "Service due" },
      { href: "/issues", label: "Issues & pickups" },
      { href: "/assets", label: "All ACs" },
      { href: "/bills", label: "Bills" },
      { href: "/notifications", label: "Notifications", badgeKey: "notifications" },
    ];
  }
  // admin + branch_manager
  const items: NavItem[] = [
    { href: "/", label: "Home" },
    { href: "/rooms", label: "Rooms" },
    { href: "/assets", label: "Assets" },
    { href: "/transfers", label: "Transfers", badgeKey: "transfers" },
    { href: "/service", label: "Service & repairs" },
    { href: "/bills", label: "Bills" },
    { href: "/notifications", label: "Notifications", badgeKey: "notifications" },
  ];
  if (role === "admin") {
    items.push({ href: "/users", label: "People" });
  }
  return items;
}
