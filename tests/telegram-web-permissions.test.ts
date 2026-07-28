import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  getTelegramWebIdentity: vi.fn(),
  syncTelegramProjectMemberRole: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: dependencies.getSupabaseAdmin,
}));
vi.mock("@/lib/telegram-web-auth", () => ({
  getTelegramWebIdentity: dependencies.getTelegramWebIdentity,
}));
vi.mock("@/lib/telegram-membership", () => ({
  syncTelegramProjectMemberRole:
    dependencies.syncTelegramProjectMemberRole,
}));

import { getTelegramProjectAdminAccess } from "@/lib/telegram-web-permissions";

describe("Telegram web project permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getTelegramWebIdentity.mockResolvedValue({
      telegramUserRecordId: "79c37da8-8d8d-4822-b73e-77f32bd082d2",
      telegramUserId: "42",
      username: "alex",
      displayName: "Alex",
      photoUrl: null,
    });
    dependencies.syncTelegramProjectMemberRole.mockResolvedValue(null);
  });

  it("rejects project members who are not Telegram admins", async () => {
    dependencies.getSupabaseAdmin.mockReturnValue(
      supabaseWithMembership("member"),
    );

    const result = await getTelegramProjectAdminAccess("project-1");

    expect(result).toMatchObject({
      ok: false,
      status: 403,
      error: expect.stringContaining("owners and administrators"),
    });
  });

  it("allows a Telegram group administrator", async () => {
    const admin = supabaseWithMembership("admin");
    dependencies.getSupabaseAdmin.mockReturnValue(admin);

    const result = await getTelegramProjectAdminAccess("project-1");

    expect(result).toMatchObject({ ok: true, admin });
    expect(
      dependencies.syncTelegramProjectMemberRole,
    ).toHaveBeenCalledWith(
      admin,
      "project-1",
      "79c37da8-8d8d-4822-b73e-77f32bd082d2",
      "42",
    );
  });
});

function supabaseWithMembership(role: string) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { role },
    error: null,
  });
  const secondEq = vi.fn(() => ({ maybeSingle }));
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const select = vi.fn(() => ({ eq: firstEq }));
  return {
    from: vi.fn(() => ({ select })),
  };
}
