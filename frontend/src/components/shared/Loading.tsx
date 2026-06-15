"use client";

export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-transparent">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary-400 border-t-transparent" />
    </div>
  );
}
