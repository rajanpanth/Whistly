"use client";

/** Shown when no wallet is connected */
export function ConnectWalletGate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-6xl">🔒</div>
      <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
      <p className="text-gray-400">Connect your wallet to access admin controls</p>
    </div>
  );
}

/** Shown when the connected wallet is not an admin */
export function AccessDeniedGate({ walletAddress }: { walletAddress: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-6xl">⛔</div>
      <h1 className="text-2xl font-bold text-white">Access Denied</h1>
      <p className="text-gray-400">Your wallet is not authorized to access the admin panel</p>
      <p className="text-xs text-gray-600 font-mono">{walletAddress}</p>
    </div>
  );
}
