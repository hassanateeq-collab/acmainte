import { requireProfile } from "@/lib/auth";
import { listProfiles, listBranches } from "@/lib/data";
import { roleLabel } from "@/lib/perms";
import { fmtDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { AddPerson, PersonActions } from "@/components/UserForms";
import { Tag } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    return (
      <div>
        <PageHeader title="People" />
        <p style={{ color: "var(--muted)" }}>Only Admin can manage people.</p>
      </div>
    );
  }

  const [people, branches] = await Promise.all([listProfiles(), listBranches()]);

  return (
    <div>
      <PageHeader
        title="People"
        subtitle="Who can sign in, and what they can do."
        actions={<AddPerson branches={branches} />}
      />
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Added</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.full_name || "—"}{p.id === profile.id && <Tag tone="brand">you</Tag>}</td>
                <td>{p.email}</td>
                <td>{roleLabel(p.role)}</td>
                <td>{p.branch_code ?? "—"}</td>
                <td>{fmtDate(p.created_at)}</td>
                <td>{p.id === profile.id ? <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span> : <PersonActions person={p} branches={branches} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
