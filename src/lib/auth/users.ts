import type { Proposal } from "@/lib/db/schema";

export type Role = "plant_manager" | "buyer" | "controller";

export type DemoUser = { id: string; name: string; initials: string; role: Role; title: string };

export const USERS: DemoUser[] = [
  { id: "dana", name: "Dana Okafor", initials: "DO", role: "plant_manager", title: "Plant manager" },
  { id: "marcus", name: "Marcus Bell", initials: "MB", role: "buyer", title: "Senior buyer" },
  { id: "priya", name: "Priya Raman", initials: "PR", role: "controller", title: "Controller" },
];

/** Segregation of duties: who may approve which agent's proposals. */
const APPROVALS: Record<Role, Proposal["agent"][]> = {
  plant_manager: ["reorder", "expedite", "maintenance", "supplier", "copilot"],
  buyer: ["reorder", "supplier", "copilot"],
  controller: ["reorder", "supplier"],
};

export function canApprove(role: Role, agent: Proposal["agent"]): boolean {
  return APPROVALS[role].includes(agent);
}

export function findUser(id: string | undefined): DemoUser | undefined {
  return USERS.find((u) => u.id === id);
}
