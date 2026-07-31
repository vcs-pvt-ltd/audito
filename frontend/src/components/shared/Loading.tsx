"use client";

export default function Loading({ className = "h-screen" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-transparent ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary-400 border-t-transparent" />
    </div>
  );
}
