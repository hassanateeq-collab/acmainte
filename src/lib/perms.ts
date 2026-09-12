import type { Profile, Asset } from "./types";

export function isAdmin(p: Profile) {
  return p.role === "admin";
}
export function isBranchManager(p: Profile) {
  return p.role === "branch_manager";
}
export function isRepair(p: Profile) {
  return p.role === "repair";
}

/** Can this user administer (add/edit) the given asset by branch ownership? */
export function ownsAssetBranch(p: Profile, asset: Asset) {
  if (p.role === "admin") return true;
  if (p.role === "branch_manager") return p.branch_code === asset.current_branch;
  return false;
}

/** Which audience inboxes this user reads. Admin reads everything. */
export function audiencesFor(p: Profile): string[] {
  if (p.role === "admin") return ["admin"];
  if (p.role === "repair") return ["repair"];
  if (p.role === "branch_manager" && p.branch_code)
    return [`branch:${p.branch_code}`];
  return [];
}

export function roleLabel(role: Profile["role"]): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "branch_manager":
      return "Branch manager";
    case "repair":
      return "CoolTech (repair)";
  }
}
