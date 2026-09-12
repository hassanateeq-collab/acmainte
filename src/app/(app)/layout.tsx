import { requireProfile } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { audiencesFor } from "@/lib/perms";
import { unreadCount, listTransfers, listBranches } from "@/lib/data";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const [unread, transfers, branches] = await Promise.all([
    unreadCount(audiencesFor(profile)),
    listTransfers(),
    listBranches(),
  ]);

  const waiting = transfers.filter((t) => {
    if (t.status !== "waiting") return false;
    if (profile.role === "admin") return true;
    if (profile.role === "branch_manager")
      return t.from_branch === profile.branch_code;
    return false;
  }).length;

  const branchName =
    branches.find((b) => b.code === profile.branch_code)?.name ?? null;

  return (
    <Shell
      profile={profile}
      branchName={branchName}
      nav={navFor(profile.role)}
      badges={{ transfers: waiting, notifications: unread }}
    >
      {children}
    </Shell>
  );
}
