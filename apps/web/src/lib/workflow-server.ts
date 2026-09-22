import type { WorkflowSummary } from "@/lib/workflow-types";
import { cookies } from "next/headers";

const apiBase = () =>
  process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";

export async function getOrderWorkflow(
  orderID: string,
): Promise<WorkflowSummary | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const response = await fetch(
      `${apiBase()}/orders/${encodeURIComponent(orderID)}/submissions`,
      {
        cache: "no-store",
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { data: WorkflowSummary };
    return json.data;
  } catch {
    return null;
  }
}
