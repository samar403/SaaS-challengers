import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "@/lib/auth/token";
import { canApprove } from "@/lib/auth/users";

const SECRET = "test-secret-at-least-16";

describe("session tokens", () => {
  it("round-trips", async () => {
    expect(await verifySession(await signSession("dana", SECRET), SECRET)).toBe("dana");
  });
  it("rejects tampering, wrong secret and expiry", async () => {
    const t = await signSession("dana", SECRET, 1000, 0);
    expect(await verifySession(t.replace("dana", "marcus"), SECRET, 10)).toBeNull();
    expect(await verifySession(t, "another-secret-here", 10)).toBeNull();
    expect(await verifySession(t, SECRET, 5000)).toBeNull();
    expect(await verifySession("garbage", SECRET)).toBeNull();
  });
});

describe("segregation of duties", () => {
  it("only plant managers approve maintenance", () => {
    expect(canApprove("plant_manager", "maintenance")).toBe(true);
    expect(canApprove("buyer", "maintenance")).toBe(false);
    expect(canApprove("controller", "reorder")).toBe(true);
  });
});
