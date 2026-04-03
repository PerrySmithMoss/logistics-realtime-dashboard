export async function register() {
  console.log("Validating config...");

  await import("@/config/server-env");
  await import("@/config/client-env");

  console.log("Config validated.");
}
