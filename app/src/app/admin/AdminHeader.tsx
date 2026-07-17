"use client";

interface AdminHeaderProps {
  endedUnsettled: number;
}

export default function AdminHeader({ endedUnsettled }: AdminHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          ⚙ Admin Panel
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage polls, settle winners, and control the platform
        </p>
      </div>
      {endedUnsettled > 0 && (
        <div className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg">
          <span className="text-red-400 text-sm font-semibold">
            ⚠ {endedUnsettled} poll{endedUnsettled !== 1 ? "s" : ""} need settlement
          </span>
        </div>
      )}
    </div>
  );
}
