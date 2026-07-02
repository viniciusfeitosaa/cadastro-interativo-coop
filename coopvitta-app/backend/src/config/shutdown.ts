/** Estado global de desligamento gracioso (SIGTERM/SIGINT). */
let shuttingDown = false;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function markShuttingDown(): void {
  shuttingDown = true;
}
