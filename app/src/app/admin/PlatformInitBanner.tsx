"use client";

interface PlatformInitBannerProps {
  initializing: boolean;
  onInitialize: () => void;
}

export default function PlatformInitBanner({ initializing, onInitialize }: PlatformInitBannerProps) {
  return (
    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center justify-between">
      <div>
        <p className="text-yellow-400 font-semibold">⚠ Platform Not Initialized</p>
        <p className="text-sm text-gray-400 mt-1">
          The PlatformConfig PDA must be initialized once before polls and voting work.
        </p>
      </div>
      <button
        onClick={onInitialize}
        disabled={initializing}
        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-semibold rounded-lg transition-colors"
      >
        {initializing ? "Initializing..." : "Initialize Platform"}
      </button>
    </div>
  );
}
