import { ChromeBookmarksBackgroundRuntime, type ChromeBookmarksRuntimeChrome } from "./backgroundRuntime.js";

declare const chrome: ChromeBookmarksRuntimeChrome;

const runtime = new ChromeBookmarksBackgroundRuntime({ chrome });

runtime.start().catch((error: unknown) => {
  console.error("Wisp Pocket Chrome Bookmarks extension failed to start", error);
});
