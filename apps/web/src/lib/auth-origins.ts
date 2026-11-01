export function trustedAuthenticationOrigins(appUrl: string) {
  const configured = new URL(appUrl);
  const origins = new Set([configured.origin]);

  const localAlias =
    configured.hostname === "127.0.0.1"
      ? "localhost"
      : configured.hostname === "localhost"
        ? "127.0.0.1"
        : undefined;
  if (localAlias) {
    const alias = new URL(configured.origin);
    alias.hostname = localAlias;
    origins.add(alias.origin);
  }

  return [...origins];
}
