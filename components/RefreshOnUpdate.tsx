"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (so we get update events) and reloads when a new
 * version activates, so the app always loads the latest version after a deploy.
 */
export function RefreshOnUpdate() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;

    let reloading = false;

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    (async () => {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
      if (!reg) return;
      reg.addEventListener("controllerchange", onControllerChange);
      reg.update();
    })();
  }, []);

  return null;
}
