export function log(event: string, fields: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ timestamp: new Date().toISOString(), event, ...fields }));
}

export function errorSummary(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message.slice(0, 500) };
  }
  return { name: "UnknownError", message: String(error).slice(0, 500) };
}
