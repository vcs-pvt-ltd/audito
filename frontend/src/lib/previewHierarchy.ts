export function getPreviewCards<T extends { children?: T[] }>(parent: T, showParent: boolean): T[] {
  // Start with the account root when it has its own questions. After reviewing
  // those questions, Next opens the children without repeating the parent.
  return showParent ? [parent] : (parent.children || []);
}
