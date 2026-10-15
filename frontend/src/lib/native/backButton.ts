"use client";

import { useEffect, useRef } from "react";

/**
 * Android back button handlers. The newest handler runs first; one that returns
 * true has dealt with the press (closed a dialog, asked about unsaved answers,
 * went back a step). When none does, the app goes back in its history, or
 * leaves the app on a root screen (see NativeAppShell).
 */

type BackHandler = () => boolean;

const handlers: Array<{ run: () => boolean }> = [];

export function runNativeBackHandlers(): boolean {
  for (let index = handlers.length - 1; index >= 0; index--) {
    if (handlers[index].run()) return true;
  }
  return false;
}

/** Handles the Android back button while `enabled`. Does nothing on the website. */
export function useNativeBackHandler(handler: BackHandler, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const entry = { run: () => handlerRef.current() };
    handlers.push(entry);
    return () => {
      const index = handlers.indexOf(entry);
      if (index >= 0) handlers.splice(index, 1);
    };
  }, [enabled]);
}
