"use client";

import { useState, useMemo, useEffect } from "react";
import { useApp, type DemoPoll, PollStatus } from "@/components/Providers";
import { isAdminWallet } from "@/lib/constants";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import toast from "react-hot-toast";
import AdminEditModal from "./AdminEditModal";
import TxLineSettlementPanel from "./TxLineSettlementPanel";
import AdminHeader from "./AdminHeader";
import PlatformInitBanner from "./PlatformInitBanner";
import AdminStatsCards from "./AdminStatsCards";
import AdminTabsSearch, { type TabFilter } from "./AdminTabsSearch";
import AdminPollCard from "./AdminPollCard";
import AdminConfirmModal from "./AdminConfirmModal";
import { ConnectWalletGate, AccessDeniedGate } from "./AdminAccessGates";
import { PublicKey } from "@solana/web3.js";
import { buildInitializePlatformIx, sendTransaction, confirmTransactionBg, getPlatformConfigPDA } from "@/lib/program";
import { connection } from "@/lib/program.base";
import { useWallet } from "@solana/wallet-adapter-react";

/** Resolution proofs stored per poll id */
type ResolutionProofs = Record<string, string>;

function loadProofs(): ResolutionProofs {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("instinctfi_resolution_proofs") || "{}"); } catch { return {}; }
}

function saveProofsLocal(proofs: ResolutionProofs) {
  try { localStorage.setItem("instinctfi_resolution_proofs", JSON.stringify(proofs)); } catch { }
}

export default function AdminPage() {
  const { walletConnected, walletAddress, polls, votes, settlePoll, deletePoll, editPoll } = useApp();
  const isAdmin = isAdminWallet(walletAddress);
  const [tab, setTab] = useState<TabFilter>("ended");
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [selectedWinners, setSelectedWinners] = useState<Record<string, number>>({});
  const [resolutionSources, setResolutionSources] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [editingPoll, setEditingPoll] = useState<DemoPoll | null>(null);
  const [proofs, setProofs] = useState<ResolutionProofs>(loadProofs);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const { signTransaction } = useWallet();
  const [platformInitialized, setPlatformInitialized] = useState<boolean | null>(null);
  const [initializingPlatform, setInitializingPlatform] = useState(false);

  // Check if PlatformConfig PDA exists on-chain
  useEffect(() => {
    (async () => {
      try {
        const [pda] = getPlatformConfigPDA();
        const info = await connection.getAccountInfo(pda);
        setPlatformInitialized(info !== null);
      } catch {
        setPlatformInitialized(null);
      }
    })();
  }, []);

  const handleInitializePlatform = async () => {
    if (!walletAddress || !signTransaction) return;
    setInitializingPlatform(true);
    try {
      const pubkey = new PublicKey(walletAddress);
      const ix = await buildInitializePlatformIx(pubkey);
      const sig = await sendTransaction([ix], pubkey, signTransaction);
      toast.success("Platform initialized! Tx: " + sig.slice(0, 12) + "...");
      confirmTransactionBg(sig);
      setPlatformInitialized(true);
    } catch (e: any) {
      toast.error("Init failed: " + (e?.message || e));
    } finally {
      setInitializingPlatform(false);
    }
  };

  // Load proofs from Supabase on mount
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const { data } = await supabase.from("resolution_proofs").select("poll_id, source_url");
      if (data) {
        const map: ResolutionProofs = {};
        data.forEach((r: any) => { map[r.poll_id] = r.source_url; });
        setProofs((prev) => ({ ...prev, ...map }));
      }
    })();
  }, []);

  // Keep `now` fresh every 30s so filters don't go stale
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(interval);
  }, []);

  const filteredPolls = useMemo(() => {
    let list = [...polls];

    // Filter by tab
    switch (tab) {
      case "ended":
        list = list.filter(p => p.status === PollStatus.Active && now >= p.endTime);
        break;
      case "active":
        list = list.filter(p => p.status === PollStatus.Active && now < p.endTime);
        break;
      case "settled":
        list = list.filter(p => p.status === PollStatus.Settled);
        break;
      case "all":
        break;
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.creator.toLowerCase().includes(q)
      );
    }

    // Sort: ended unsettled first, then by created date desc
    list.sort((a, b) => {
      const aEnded = a.status === PollStatus.Active && now >= a.endTime;
      const bEnded = b.status === PollStatus.Active && now >= b.endTime;
      if (aEnded && !bEnded) return -1;
      if (!aEnded && bEnded) return 1;
      return b.createdAt - a.createdAt;
    });

    return list;
  }, [polls, tab, search, now]);

  const handleSettle = async (pollId: string) => {
    const winner = selectedWinners[pollId];
    if (winner === undefined) {
      toast.error("Select a winning option first");
      return;
    }
    setSettlingId(pollId);
    try {
      const ok = await settlePoll(pollId, winner);
      if (ok) {
        // Save resolution proof if provided
        const sourceUrl = resolutionSources[pollId]?.trim();
        // Validate URL format
        if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
          toast.error("Resolution source must be a valid http/https URL");
          setSettlingId(null);
          return;
        }
        if (sourceUrl) {
          const newProofs = { ...proofs, [pollId]: sourceUrl };
          setProofs(newProofs);
          saveProofsLocal(newProofs);
          if (isSupabaseConfigured) {
            await supabase.from("resolution_proofs").upsert({ poll_id: pollId, source_url: sourceUrl });
          }
        }
        toast.success("Poll settled with your chosen winner!");
      }
    } finally {
      setSettlingId(null);
    }
  };

  const handleAutoSettle = async (pollId: string) => {
    setSettlingId(pollId);
    try {
      const ok = await settlePoll(pollId);
      if (ok) {
        toast.success("Poll auto-settled by highest votes!");
      }
    } finally {
      setSettlingId(null);
    }
  };

  const getVotersForPoll = (pollId: string) => {
    return votes.filter(v => v.pollId === pollId);
  };

  const totalPool = polls.reduce((s, p) => s + p.totalPoolLamports, 0);
  const totalVoters = polls.reduce((s, p) => s + p.totalVoters, 0);
  const endedUnsettled = polls.filter(p => p.status === PollStatus.Active && now >= p.endTime).length;
  const activeCount = polls.filter(p => p.status === PollStatus.Active && now < p.endTime).length;
  const settledCount = polls.filter(p => p.status === PollStatus.Settled).length;

  if (!walletConnected) {
    return <ConnectWalletGate />;
  }

  if (!isAdmin) {
    return <AccessDeniedGate walletAddress={walletAddress} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminHeader endedUnsettled={endedUnsettled} />

      {/* Stats cards */}

      {/* Platform Initialization Banner */}
      {platformInitialized === false && (
        <PlatformInitBanner
          initializing={initializingPlatform}
          onInitialize={handleInitializePlatform}
        />
      )}

      {/* TxLINE settlement panel */}
      <TxLineSettlementPanel />

      {/* Stats cards (original) */}
      <AdminStatsCards
        totalPolls={polls.length}
        activeCount={activeCount}
        endedUnsettled={endedUnsettled}
        settledCount={settledCount}
        totalPool={totalPool}
      />

      {/* Tabs + Search */}
      <AdminTabsSearch
        tab={tab}
        onTabChange={setTab}
        search={search}
        onSearchChange={setSearch}
        endedUnsettled={endedUnsettled}
      />

      {/* Polls list */}
      <div className="space-y-3">
        {filteredPolls.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">📭</div>
            No polls in this category
          </div>
        )}

        {filteredPolls.map(poll => (
          <AdminPollCard
            key={poll.id}
            poll={poll}
            isEnded={now >= poll.endTime}
            pollVoters={getVotersForPoll(poll.id)}
            proof={proofs[poll.id]}
            settlement={{
              selectedWinner: selectedWinners[poll.id],
              onSelectWinner: (i) => setSelectedWinners(prev => ({ ...prev, [poll.id]: i })),
              resolutionSource: resolutionSources[poll.id] || "",
              onResolutionSourceChange: (value) => setResolutionSources((prev) => ({ ...prev, [poll.id]: value })),
              isSettling: settlingId === poll.id,
              onSettle: () => handleSettle(poll.id),
              onAutoSettle: () => handleAutoSettle(poll.id),
            }}
            onEdit={() => setEditingPoll(poll)}
            onDelete={(title, message) => {
              setConfirmModal({
                title,
                message,
                onConfirm: () => { deletePoll(poll.id); setConfirmModal(null); },
              });
            }}
          />
        ))}
      </div>

      {/* Edit Modal */}
      {editingPoll && (
        <AdminEditModal
          poll={editingPoll}
          onClose={() => setEditingPoll(null)}
          onSave={async (updates) => {
            const ok = await editPoll(editingPoll.id, updates);
            if (ok) {
              setEditingPoll(null);
            }
            return ok;
          }}
        />
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <AdminConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
