export function createBuildInfo(): {
  builtAt: string;
  branch: string;
  commit: string;
  dirty: boolean | "unknown";
};
