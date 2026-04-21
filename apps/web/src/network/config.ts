const DEFAULT_SOCKET_PORT = "3001";

type BrowserLocationLike = {
  protocol: string;
  hostname: string;
};

export const resolveSocketUrl = (
  explicitUrl?: string,
  locationLike?: BrowserLocationLike,
) => {
  if (explicitUrl?.trim()) {
    return explicitUrl.trim();
  }

  if (locationLike?.hostname) {
    const protocol = locationLike.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${locationLike.hostname}:${DEFAULT_SOCKET_PORT}`;
  }

  return `http://localhost:${DEFAULT_SOCKET_PORT}`;
};

export const SOCKET_URL = resolveSocketUrl(
  import.meta.env.VITE_SOCKET_URL?.toString(),
  typeof window === "undefined" ? undefined : window.location,
);
