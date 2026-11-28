import { describe, expect, it, vi } from "vitest";
import type { LogListItem, Paginated } from "@daydone/shared";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import { ErrorCode, MAX_DESCRIPTION_LENGTH } from "@daydone/shared";
import { ApiError } from "./api-client";
import {
  buildLogsListEndpoint,
  getLogDateConflict,
  getNextLogsPageParam,
  isNotFoundError,
  resolveInitialFormDate,
  SIGNED_URL_STALE_TIME_MS,
  validateLogFormInput,
} from "./logs-api";

describe("logs-api helpers (mobile)", () => {
  it("buildLogsListEndpoint membangun query string bersih dan mengabaikan spasi kosong", () => {
    expect(buildLogsListEndpoint()).toBe("/logs");
    expect(
      buildLogsListEndpoint({
        page: 2,
        limit: 20,
        search: "  meeting sprint  ",
      }),
    ).toBe("/logs?page=2&limit=20&search=meeting+sprint");
    expect(buildLogsListEndpoint({ search: "   " })).toBe("/logs");
  });

  it("getNextLogsPageParam mengembalikan halaman berikutnya hanya bila masih ada halaman tersisa", () => {
    const page1Of3: Paginated<LogListItem> = {
      data: [],
      meta: { page: 1, limit: 20, total: 50, totalPages: 3 },
    };
    const lastPage: Paginated<LogListItem> = {
      data: [],
      meta: { page: 3, limit: 20, total: 50, totalPages: 3 },
    };
    const emptyPage: Paginated<LogListItem> = {
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };

    expect(getNextLogsPageParam(page1Of3)).toBe(2);
    expect(getNextLogsPageParam(lastPage)).toBeUndefined();
    expect(getNextLogsPageParam(emptyPage)).toBeUndefined();
  });

  it("isNotFoundError hanya bernilai true untuk ApiError dengan status 404", () => {
    const err404 = new ApiError({
      statusCode: 404,
      message: "Tidak ditemukan",
    });
    const err500 = new ApiError({ statusCode: 500, message: "Server error" });
    const genericErr = new Error("Network failed");

    expect(isNotFoundError(err404)).toBe(true);
    expect(isNotFoundError(err500)).toBe(false);
    expect(isNotFoundError(genericErr)).toBe(false);
  });

  it("SIGNED_URL_STALE_TIME_MS bernilai 4 menit (< 5 menit masa berlaku signed URL)", () => {
    expect(SIGNED_URL_STALE_TIME_MS).toBe(4 * 60 * 1000);
  });

  it("getLogDateConflict mengekstrak existingLogId dan pesan untuk error 409 LOG_DATE_CONFLICT", () => {
    const conflictErr = new ApiError({
      statusCode: 409,
      code: ErrorCode.LOG_DATE_CONFLICT,
      message: "Logbook untuk tanggal 2026-11-28 sudah ada",
      existingLogId: "log-uuid-99",
    });
    const other409 = new ApiError({
      statusCode: 409,
      code: ErrorCode.ATTACHMENT_LIMIT_REACHED,
      message: "Maksimal 5 foto",
    });
    const err500 = new ApiError({ statusCode: 500, message: "Server error" });

    expect(getLogDateConflict(conflictErr)).toEqual({
      message: expect.any(String),
      existingLogId: "log-uuid-99",
    });
    expect(getLogDateConflict(other409)).toBeNull();
    expect(getLogDateConflict(err500)).toBeNull();
    expect(getLogDateConflict(new Error("Network"))).toBeNull();
  });

  it("validateLogFormInput memvalidasi tanggal lokal, deskripsi wajib, dan batas maksimal karakter", () => {
    const today = "2026-11-28";

    const ok = validateLogFormInput(
      { date: "2026-11-28", description: "  Menyelesaikan form mobile  " },
      today,
    );
    expect(ok).toEqual({
      valid: true,
      data: {
        date: "2026-11-28",
        description: "Menyelesaikan form mobile",
      },
    });

    const futureDate = validateLogFormInput(
      { date: "2026-11-29", description: "Catatan besok" },
      today,
    );
    expect(futureDate.valid).toBe(false);
    if (!futureDate.valid) {
      expect(futureDate.errors.date).toContain("hari ini");
    }

    const emptyDesc = validateLogFormInput(
      { date: "2026-11-28", description: "   " },
      today,
    );
    expect(emptyDesc.valid).toBe(false);
    if (!emptyDesc.valid) {
      expect(emptyDesc.errors.description).toBe("Deskripsi wajib diisi");
    }

    const tooLongDesc = validateLogFormInput(
      {
        date: "2026-11-28",
        description: "a".repeat(MAX_DESCRIPTION_LENGTH + 1),
      },
      today,
    );
    expect(tooLongDesc.valid).toBe(false);
    if (!tooLongDesc.valid) {
      expect(tooLongDesc.errors.description).toContain(
        String(MAX_DESCRIPTION_LENGTH),
      );
    }
  });

  it("resolveInitialFormDate memakai ?date yang valid <= today dan fallback ke today bila tidak valid", () => {
    const today = "2026-11-28";
    expect(resolveInitialFormDate("2026-11-25", today)).toBe("2026-11-25");
    expect(resolveInitialFormDate(["2026-11-20"], today)).toBe("2026-11-20");
    expect(resolveInitialFormDate("2026-11-30", today)).toBe(today);
    expect(resolveInitialFormDate("2026-02-30", today)).toBe(today);
    expect(resolveInitialFormDate(undefined, today)).toBe(today);
  });
});
