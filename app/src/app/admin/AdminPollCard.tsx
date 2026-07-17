"use client";

import { formatDollars, type DemoPoll, type DemoVote, PollStatus } from "@/components/Providers";

/** Settlement-related state and handlers for a single poll, owned by the admin page */
export interface PollSettlementControls {
  selectedWinner: number | undefined;
  onSelectWinner: (idx: number) => void;
  resolutionSource: string;
  onResolutionSourceChange: (value: string) => void;
  isSettling: boolean;
  onSettle: () => void;
  onAutoSettle: () => void;
}

interface AdminPollCardProps {
  poll: DemoPoll;
  isEnded: boolean;
  pollVoters: DemoVote[];
  proof: string | undefined;
  settlement: PollSettlementControls;
  onEdit: () => void;
  onDelete: (title: string, message: string) => void;
}

export default function AdminPollCard({ poll, isEnded, pollVoters, proof, settlement, onEdit, onDelete }: AdminPollCardProps) {
  const {
    selectedWinner,
    onSelectWinner,
    resolutionSource,
    onResolutionSourceChange,
    isSettling,
    onSettle,
    onAutoSettle,
  } = settlement;

  const isSettled = poll.status === PollStatus.Settled;
  const needsSettlement = poll.status === PollStatus.Active && isEnded;
  const totalVotes = poll.voteCounts.reduce((a, b) => a + b, 0);
  const highestIdx = poll.voteCounts.indexOf(Math.max(...poll.voteCounts));

  return (
    <div
      className={`bg-surface-50 border rounded-xl p-4 transition-colors ${needsSettlement
        ? "border-red-500/40 bg-red-500/5"
        : isSettled
          ? "border-green-500/30"
          : "border-border"
        }`}
    >
      {/* Poll header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate">{poll.title}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${needsSettlement
              ? "bg-red-500/20 text-red-400"
              : isSettled
                ? "bg-green-500/20 text-green-400"
                : "bg-blue-500/20 text-blue-400"
              }`}>
              {needsSettlement ? "⏰ NEEDS SETTLEMENT" : isSettled ? "✓ SETTLED" : "● ACTIVE"}
            </span>
            {poll.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/50 text-gray-400">
                {poll.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>by {poll.creator.slice(0, 4)}...{poll.creator.slice(-4)}</span>
            <span>•</span>
            <span>{totalVotes} votes</span>
            <span>•</span>
            <span>{poll.totalVoters} voters</span>
            <span>•</span>
            <span>Pool: {formatDollars(poll.totalPoolLamports)}</span>
            <span>•</span>
            <span>
              {isEnded
                ? `Ended ${new Date(poll.endTime * 1000).toLocaleDateString()}`
                : `Ends ${new Date(poll.endTime * 1000).toLocaleDateString()}`
              }
            </span>
          </div>
        </div>
      </div>

      {/* Options with vote bars */}
      <div className="space-y-2 mb-3">
        {poll.options.map((opt, i) => {
          const count = poll.voteCounts[i] || 0;
          const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
          const isWinner = isSettled && poll.winningOption === i;
          const isSelected = selectedWinner === i;
          const isHighest = i === highestIdx && totalVotes > 0;

          return (
            <div key={i} className="relative">
              <button
                disabled={isSettled || !needsSettlement}
                onClick={() => onSelectWinner(i)}
                className={`w-full text-left relative overflow-hidden rounded-lg px-3 py-2 border transition-all ${isWinner
                  ? "border-green-500/60 bg-green-500/10"
                  : isSelected
                    ? "border-brand-500/60 bg-brand-500/10 ring-1 ring-brand-500/30"
                    : needsSettlement
                      ? "border-gray-600/50 hover:border-gray-500/70 cursor-pointer"
                      : "border-border/30"
                  }`}
              >
                {/* Progress bar background */}
                <div
                  className={`absolute inset-0 opacity-15 ${isWinner ? "bg-green-500" : isSelected ? "bg-brand-500" : "bg-gray-500"
                    }`}
                  style={{ width: `${pct}%` }}
                />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {needsSettlement && (
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-brand-500 bg-brand-500" : "border-gray-500"
                        }`}>
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    )}
                    {isWinner && <span className="text-green-400">🏆</span>}
                    <span className={`text-sm ${isWinner ? "text-green-300 font-semibold" : "text-gray-300"}`}>
                      {opt}
                    </span>
                    {isHighest && !isSettled && (
                      <span className="text-[10px] px-1 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                        Leading
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{count} votes</span>
                    <span className={`text-xs font-mono ${isWinner ? "text-green-400" : "text-gray-500"}`}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      {needsSettlement && (
        <div className="space-y-2 pt-2 border-t border-border/30">
          {/* Resolution source URL */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 shrink-0">🔗 Source:</label>
            <input
              type="url"
              placeholder="Resolution proof URL (optional)"
              value={resolutionSource}
              onChange={(e) => onResolutionSourceChange(e.target.value)}
              className="flex-1 bg-surface-50 border border-border rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-brand-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSettle}
              disabled={isSettling || selectedWinner === undefined}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${selectedWinner !== undefined
                ? "bg-brand-500 hover:bg-brand-600 text-white"
                : "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                }`}
            >
              {isSettling ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Settling...
                </span>
              ) : selectedWinner !== undefined ? (
                `✓ Settle → "${poll.options[selectedWinner]}"`
              ) : (
                "Select a winner above"
              )}
            </button>
            <button
              onClick={onAutoSettle}
              disabled={isSettling || totalVotes === 0}
              className="px-3 py-2 bg-surface-100 hover:bg-dark-600 border border-gray-600/50 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-40"
              title="Auto-settle by highest votes"
            >
              ⚡ Auto (highest votes)
            </button>
            <button
              onClick={onEdit}
              className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm text-blue-400 transition-colors"
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => {
                onDelete("Delete Poll", "Delete this poll? This cannot be undone.");
              }}
              disabled={isSettling}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors ml-auto"
            >
              🗑 Delete
            </button>
          </div>
        </div>
      )}

      {/* Show resolution proof for settled polls */}
      {isSettled && proof && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <span>🔗 Resolution:</span>
          <a
            href={proof}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:text-brand-300 underline underline-offset-2 truncate max-w-xs"
          >
            {proof}
          </a>
        </div>
      )}

      {/* Admin actions for active polls */}
      {!isSettled && !needsSettlement && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
          <button
            onClick={onEdit}
            className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm text-blue-400 transition-colors"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => {
              onDelete("Delete Active Poll", "Delete this active poll? This cannot be undone.");
            }}
            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors"
          >
            🗑 Delete
          </button>
        </div>
      )}

      {/* Admin actions for settled polls */}
      {isSettled && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
          <span className="text-xs text-gray-500">Winner:</span>
          <span className="text-sm text-green-400 font-semibold">
            🏆 {poll.winningOption < poll.options.length ? poll.options[poll.winningOption] : "None"}
          </span>
          <span className="text-xs text-gray-500">
            {poll.winningOption < poll.options.length ? `${poll.voteCounts[poll.winningOption]} winning votes` : ""} • Pool: {formatDollars(poll.totalPoolLamports)}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onEdit}
              className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm text-blue-400 transition-colors"
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => {
                onDelete("Delete Settled Poll", "Delete this settled poll? This cannot be undone.");
              }}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors"
            >
              🗑 Delete
            </button>
          </div>
        </div>
      )}

      {/* Voters breakdown (collapsible) */}
      {pollVoters.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 transition-colors">
            View {pollVoters.length} voter{pollVoters.length !== 1 ? "s" : ""} details
          </summary>
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {pollVoters.map((v, vi) => (
              <div key={vi} className="flex items-center justify-between text-xs bg-surface-0/50 rounded-lg px-3 py-1.5">
                <span className="text-gray-400 font-mono">
                  {v.voter.slice(0, 4)}...{v.voter.slice(-4)}
                </span>
                <div className="flex items-center gap-3">
                  {v.votesPerOption.map((count, oi) => (
                    count > 0 && (
                      <span key={oi} className={`${isSettled && poll.winningOption === oi ? "text-green-400" : "text-gray-500"
                        }`}>
                        {poll.options[oi]}: {count}
                      </span>
                    )
                  ))}
                  <span className="text-brand-400">{formatDollars(v.totalStakedLamports)}</span>
                  {v.claimed && <span className="text-green-500">✓ claimed</span>}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
