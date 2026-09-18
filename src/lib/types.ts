export type Role = "admin" | "branch_manager" | "repair";
export type JobType = "Service" | "Repair" | "Charge";
export type TransferStatus = "waiting" | "accepted" | "declined";

export type Branch = { code: string; name: string; sort: number };

export type AssetType = {
  code: string;
  name: string;
  has_parts: boolean;
  sort: number;
};

export type Room = {
  id: string;
  branch_code: string;
  room_number: string;
  status: string | null;
  status_note: string | null;
  sort: number;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  branch_code: string | null;
  created_at: string;
};

export type Asset = {
  id: string;
  type: string;
  part: "I" | "E" | null;
  home_branch: string;
  current_branch: string;
  room: string | null;
  seq: number;
  installed_date: string | null;
  expected_life_years: number;
  last_service_date: string | null;
  service_interval_days: number;
  last_general_service_date: string | null;
  general_interval_days: number;
  open_issue: string | null;
  at_vendor: boolean;
  paired_with: string | null;
  is_spare: boolean;
  created_at: string;
};

export type Transfer = {
  id: string;
  asset_id: string;
  from_branch: string;
  to_branch: string;
  to_room: string | null;
  reason: string | null;
  status: TransferStatus;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  installed: boolean;
  installed_by: string | null;
  installed_by_name: string | null;
  installed_at: string | null;
};

export type Job = {
  id: string;
  asset_id: string;
  date: string;
  type: JobType;
  problem: string | null;
  work_done: string | null;
  service_kind: string | null; // 'General' | 'Normal' for Service jobs
  bill_amount: number;
  days_taken: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  deleted: boolean;
};

export type JobCharge = {
  id: string;
  job_id: string;
  label: string;
  amount: number;
  date: string;
  created_by_name: string | null;
  created_at: string;
};

export type JobEdit = {
  id: string;
  job_id: string;
  summary: string;
  reason: string;
  edited_by_name: string | null;
  created_at: string;
};

export type AssetEvent = {
  id: string;
  asset_id: string;
  kind: string;
  description: string;
  actor_name: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  audience: string;
  message: string;
  kind: string | null;
  asset_id: string | null;
  transfer_id: string | null;
  read: boolean;
  created_at: string;
};

export type AssetStatus =
  | "With CoolTech"
  | "Issue reported"
  | "Service due"
  | "Healthy";
