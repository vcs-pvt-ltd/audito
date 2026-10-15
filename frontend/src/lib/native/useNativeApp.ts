"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "./platform";

/**
 * isNativeApp() for rendering. It is false on the first render, matching the
 * static HTML, and becomes true after mount inside the Android app.
 */
export function useNativeApp(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => { setNative(isNativeApp()); }, []);
  return native;
}
