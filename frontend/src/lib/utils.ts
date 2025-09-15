import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const localBackend = import.meta.env.VITE_BACKEND_URL_LOCAL;
const lanBackend   = import.meta.env.VITE_BACKEND_URL_LAN;

/**
 * Returns which backend URL to use, based on current host.
 */
export function getBackendUrl() {
  const hostname = window.location.hostname;

  // If you're developing locally
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log("Using local backend:", localBackend);
    return localBackend;
  }

  // If the app is loaded via the LAN IP
  // Optionally you can do a regex if many lan IPs
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
    console.log("Using LAN backend:", lanBackend);
    return lanBackend;
  }

  // Fallback (maybe production)
  console.log("Using localBackend (fallback)", localBackend);
  return localBackend;
}