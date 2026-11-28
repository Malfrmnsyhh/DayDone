import { describe, expect, it, vi } from "vitest";
import type { LogListItem, Paginated } from "@daydone/shared";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import { ApiError } from "./api-client";
import {
  buildLogsListEndpoint,
  getNextLogsPageParam,
  isNotFoundError,
  SIGNED_URL_STALE_TIME_MS,
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
});
