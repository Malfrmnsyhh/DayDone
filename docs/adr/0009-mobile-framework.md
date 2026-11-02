# ADR-0009: Framework mobile — React Native (Expo)

**Status:** Proposed (diputuskan sebelum M8)
**Tanggal:** 2026-11-02

## Context
Pemilik proyek mempertimbangkan React Native atau Flutter.

## Decision (usulan)
React Native dengan Expo (development build, expo-router), agar seluruh proyek tetap TypeScript dan bisa memakai `@daydone/shared` secara langsung.

## Options Considered
| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| **React Native (Expo)** | Satu bahasa; schema Zod dan tipe dipakai langsung; EAS Build memudahkan APK | Login Google native butuh development build |
| Flutter | Performa UI sangat baik; pemilik ingin belajar | Dart, tidak bisa memakai `packages/shared`; client harus di-generate dari OpenAPI (`/api/docs-json`) dan validasi ditulis ulang |

## Consequences
- Bila Flutter dipilih: tambahkan langkah generate client Dart dari OpenAPI di CI, ubah ADR ini menjadi Accepted dengan opsi Flutter, dan sesuaikan M8 di roadmap.
