import { row, rows, upsert } from "@/lib/db";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/domain/settings";

type SettingRow = { key: string; value: unknown };

export async function getSettings(): Promise<AppSettings> {
  const stored = Object.fromEntries((await rows<SettingRow>("settings")).map((r) => [r.key, r.value])) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS)
        .filter((key) => key in stored)
        .map((key) => [key, stored[key as keyof AppSettings]]),
    ),
    profile: { ...DEFAULT_SETTINGS.profile, ...stored.profile },
  };
}

export function setSetting(key: string, value: unknown): Promise<void> {
  return upsert("settings", [{ key, value }], ["userId", "key"]);
}

export function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  return upsert("settings", Object.entries(patch).map(([key, value]) => ({ key, value })), ["userId", "key"]);
}

export async function getRawSetting<T>(key: string): Promise<T | undefined> {
  return (await row<SettingRow>("settings", { key }))?.value as T | undefined;
}
