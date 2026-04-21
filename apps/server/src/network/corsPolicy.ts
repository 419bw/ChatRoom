const PRIVATE_NETWORK_PATTERNS = [
  /^localhost$/i,
  /^127(?:\.\d{1,3}){3}$/,
  /^10(?:\.\d{1,3}){3}$/,
  /^192\.168(?:\.\d{1,3}){2}$/,
  /^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/,
] as const;

const trimList = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const isAllowedOrigin = (origin: string | undefined, extraOrigins: string[] = []) => {
  if (!origin) {
    return true;
  }

  if (extraOrigins.includes(origin)) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);

    if (PRIVATE_NETWORK_PATTERNS.some((pattern) => pattern.test(hostname))) {
      return true;
    }

    // 局域网环境下常见通过主机名访问，例如 http://DESKTOP-ABC:5173
    if (!hostname.includes(".") && /^[a-z0-9-]+$/i.test(hostname)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

export const createCorsOriginValidator = (extraOriginValue?: string) => {
  const extraOrigins = trimList(extraOriginValue);

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    callback(null, isAllowedOrigin(origin, extraOrigins));
  };
};
