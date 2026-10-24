import type {
  PlatformExtensionModule,
  PlatformExtensionModuleImporter,
} from "@assistant/platform-extension-runtime";

// Resolve deployment-approved packages from the application composition root. Under pnpm's
// isolated layout, resolving inside the generic runtime package cannot see consumer dependencies.
export const importInstalledPlatformExtension: PlatformExtensionModuleImporter = async (
  moduleSpecifier,
) => (await import(moduleSpecifier)) as PlatformExtensionModule;
