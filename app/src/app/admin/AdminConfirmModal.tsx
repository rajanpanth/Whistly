"use client";

import Modal from "@/components/Modal";

interface AdminConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AdminConfirmModal({ title, message, onConfirm, onCancel }: AdminConfirmModalProps) {
  return (
    <Modal isOpen onClose={onCancel} maxWidth="max-w-sm" title={title} className="p-6">
      <h3 className="text-lg font-semibold text-neutral-100 mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 mb-5">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium text-neutral-400 hover:bg-surface-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-semibold text-white transition-colors"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}
