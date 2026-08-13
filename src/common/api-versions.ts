// Single source of truth for which API versions the app answers.
//
// `defaultVersion` (used by URI versioning) and the enabled set are both
// anchored here so main.ts, the VersionGate and the README stay in step.
export const DEFAULT_API_VERSION = '1';

// API_VERSIONS_ENABLED is a comma-separated list of enabled versions
// (e.g. '1' or '1,2'). Unset falls back to just the default version, so a
// stock deploy serves v1 without any configuration. Parsing happens per call
// so an operator env change takes effect on a fleet restart/reload with no
// rebuild.
export function enabledApiVersions(): Set<string> {
  const raw = process.env.API_VERSIONS_ENABLED;
  if (raw === undefined || raw.trim() === '') {
    return new Set([DEFAULT_API_VERSION]);
  }
  return new Set(
    raw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v !== ''),
  );
}
