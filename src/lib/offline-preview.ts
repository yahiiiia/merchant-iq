// Vite replaces the server-only opt-in with false for every build command.
export const OFFLINE_PREVIEW = import.meta.env.DEV && __MERCHANTIQ_OFFLINE_PREVIEW__;
