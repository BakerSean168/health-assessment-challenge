export function assertNever(value: never, context = "variant"): never {
  throw new Error(`Unexpected ${context}: ${JSON.stringify(value)}`);
}
