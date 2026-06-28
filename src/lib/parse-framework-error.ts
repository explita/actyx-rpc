export function parseFrameworkError(err: any) {
  if (
    err &&
    typeof err === "object" &&
    typeof err.digest === "string" &&
    err.digest.startsWith("NEXT_REDIRECT")
  ) {
    throw err;
  }
}
