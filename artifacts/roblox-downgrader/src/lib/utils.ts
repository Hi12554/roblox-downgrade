import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDownloadUrl(type: string, versionHash: string) {
  switch (type) {
    case "WindowsPlayer":
      return `https://setup.rbxcdn.com/${versionHash}-RobloxPlayerLauncher.exe`;
    case "Studio64":
    case "Studio":
      return `https://setup.rbxcdn.com/${versionHash}-RobloxStudioLauncherBeta.exe`;
    case "MacPlayer":
      return `https://setup.rbxcdn.com/mac/${versionHash}-RobloxPlayer.dmg`;
    case "MacStudio":
      return `https://setup.rbxcdn.com/mac/${versionHash}-RobloxStudio.dmg`;
    default:
      return "#";
  }
}
