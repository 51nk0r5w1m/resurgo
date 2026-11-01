type DemoEnvironment = Record<string, string | undefined>;

export function isExternalDemoMode(environment: DemoEnvironment = process.env) {
  return environment.RESURGO_DEMO_EXTERNAL === "true";
}

export function blocksExternalDemoRegistration(
  pathname: string,
  environment: DemoEnvironment = process.env,
) {
  return (
    isExternalDemoMode(environment) &&
    pathname.replace(/^\/api\/auth/u, "") === "/sign-up/email"
  );
}
