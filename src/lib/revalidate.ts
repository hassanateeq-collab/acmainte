import { revalidatePath } from "next/cache";

/** Revalidate the pages that any mutation might affect. */
export function revalidateAll() {
  for (const p of [
    "/",
    "/assets",
    "/transfers",
    "/service",
    "/issues",
    "/bills",
    "/notifications",
    "/users",
  ]) {
    revalidatePath(p);
  }
  revalidatePath("/assets/[id]", "page");
}
