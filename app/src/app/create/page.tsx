"use client";

import { useState, useEffect, useRef } from "react";
import { useApp, SOL_UNIT } from "@/components/Providers";
import { isAdminWallet } from "@/lib/constants";
import { uploadPollImage } from "@/lib/uploadImage";
import { sanitizeTitle, sanitizeDescription, sanitizeOptions } from "@/lib/sanitize";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/languageContext";
import TemplatePicker, { Template } from "./TemplatePicker";
import MainImageField from "./MainImageField";
import BasicDetailsFields from "./BasicDetailsFields";
import OptionsEditor, { MAX_OPTIONS } from "./OptionsEditor";
import PricingSubmitSection from "./PricingSubmitSection";

export default function CreatePollPage() {
  const { walletConnected, walletAddress, userAccount, createPoll, connectWallet } = useApp();
  const router = useRouter();
  const { t } = useLanguage();

  // ── Form state ──
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("World Cup");
  const [options, setOptions] = useState(["", ""]);
  const [unitPrice, setUnitPrice] = useState("0.01");
  const [durationHours, setDurationHours] = useState("24");
  const [investment, setInvestment] = useState("0.5");

  // ── Main image state ──
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // ── Option image states (for all options) ──
  const [optionImageFiles, setOptionImageFiles] = useState<(File | null)[]>([null, null]);
  const [optionImagePreviews, setOptionImagePreviews] = useState<(string | null)[]>([null, null]);
  const [optionImageErrors, setOptionImageErrors] = useState<(string | null)[]>([null, null]);

  const [submitting, setSubmitting] = useState(false);

  // ── Clean up blob URLs on unmount to prevent memory leaks ──
  const imagePreviewRef = useRef(imagePreview);
  const optionPreviewsRef = useRef(optionImagePreviews);
  imagePreviewRef.current = imagePreview;
  optionPreviewsRef.current = optionImagePreviews;

  useEffect(() => {
    return () => {
      if (imagePreviewRef.current?.startsWith("blob:")) URL.revokeObjectURL(imagePreviewRef.current);
      optionPreviewsRef.current.forEach(p => {
        if (p?.startsWith("blob:")) URL.revokeObjectURL(p);
      });
    };
  }, []);

  // ── Auth gate ──
  if (!walletConnected) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg mb-4">{t("connectWalletToCreate")}</p>
        <button onClick={connectWallet} className="px-6 py-3 bg-brand-500 hover:bg-brand-600 rounded-xl font-semibold transition-colors">
          {t("connectPhantom")}
        </button>
      </div>
    );
  }

  if (!isAdminWallet(walletAddress)) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] px-6 py-16 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/10 text-2xl">🔒</div>
        <h1 className="mt-5 text-2xl font-bold text-white">Admin access required</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Only an approved Whistly administrator wallet can create a market.</p>
        <button onClick={() => router.push("/events")} className="mt-7 rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-[#00131f]">Browse markets</button>
      </div>
    );
  }
  // ── Main image handlers ──
  const handleImageSelect = (file: File) => {
    setImageFile(file);
    setImageError(null);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageRemove = () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
  };

  // ── Option image handlers ──
  const handleOptionImageSelect = (index: number) => (file: File) => {
    const newFiles = [...optionImageFiles];
    newFiles[index] = file;
    setOptionImageFiles(newFiles);

    const newPreviews = [...optionImagePreviews];
    newPreviews[index] = URL.createObjectURL(file);
    setOptionImagePreviews(newPreviews);

    const newErrors = [...optionImageErrors];
    newErrors[index] = null;
    setOptionImageErrors(newErrors);
  };

  const handleOptionImageRemove = (index: number) => () => {
    const preview = optionImagePreviews[index];
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);

    const newFiles = [...optionImageFiles];
    newFiles[index] = null;
    setOptionImageFiles(newFiles);

    const newPreviews = [...optionImagePreviews];
    newPreviews[index] = null;
    setOptionImagePreviews(newPreviews);

    const newErrors = [...optionImageErrors];
    newErrors[index] = null;
    setOptionImageErrors(newErrors);
  };

  // ── Option handlers ──
  const addOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, ""]);
      setOptionImageFiles(prev => [...prev, null]);
      setOptionImagePreviews(prev => [...prev, null]);
      setOptionImageErrors(prev => [...prev, null]);
    }
  };

  const removeOption = (idx: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== idx));
      setOptionImageFiles(prev => prev.filter((_, i) => i !== idx));
      setOptionImagePreviews(prev => prev.filter((_, i) => i !== idx));
      setOptionImageErrors(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const updateOption = (idx: number, val: string) => {
    setOptions(options.map((o, i) => (i === idx ? val : o)));
  };

  // ── Submit handler ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Sanitize inputs
    const cleanTitle = sanitizeTitle(title);
    const cleanDesc = sanitizeDescription(description);
    const cleanOptions = sanitizeOptions(options);

    if (!cleanTitle) return toast.error("Title is required");
    if (cleanOptions.some((o) => !o)) return toast.error("All options must have labels");
    if (parseFloat(unitPrice) <= 0) return toast.error("Invalid unit price");

    const unitPriceLamports = Math.floor(parseFloat(unitPrice) * SOL_UNIT);
    const endTime = Math.floor(Date.now() / 1000) + parseInt(durationHours) * 3600;
    const CREATION_FEE = 500_000_000; // 0.5 SOL flat fee

    if (userAccount && CREATION_FEE > userAccount.balance) {
      return toast.error("Insufficient SOL balance (need 0.5 SOL creation fee)");
    }

    setSubmitting(true);

    try {
      // Upload main image
      let imageUrl = "";
      if (imageFile) {
        setImageUploading(true);
        try {
          imageUrl = await uploadPollImage(imageFile);
        } catch (err: any) {
          setImageError(err.message || "Image upload failed");
          setImageUploading(false);
          setSubmitting(false);
          return toast.error(err.message || "Image upload failed");
        }
        setImageUploading(false);
      }

      // Upload option images (all options)
      const optionImageUrls: string[] = [];
      for (let i = 0; i < options.length; i++) {
        const file = optionImageFiles[i];
        if (file) {
          try {
            const url = await uploadPollImage(file);
            optionImageUrls.push(url);
          } catch (err: any) {
            const newErrors = [...optionImageErrors];
            newErrors[i] = err.message || "Upload failed";
            setOptionImageErrors(newErrors);
            setSubmitting(false);
            return toast.error(`Option ${i + 1} image upload failed`);
          }
        } else {
          optionImageUrls.push("");
        }
      }

      const poll = await createPoll({
        pollId: crypto.getRandomValues(new Uint32Array(1))[0] * 1000 + (Date.now() % 1000),
        creator: walletAddress!,
        title: cleanTitle,
        description: cleanDesc,
        category,
        imageUrl,
        optionImages: optionImageUrls,
        options: cleanOptions,
        voteCounts: [],
        unitPriceLamports,
        endTime,
        totalPoolLamports: 0,
        creatorInvestmentLamports: CREATION_FEE,
        platformFeeLamports: 0,
        creatorRewardLamports: 0,
        status: 0,
        winningOption: 255,
        totalVoters: 0,
        createdAt: Math.floor(Date.now() / 1000),
        marketKind: 0,
      });

      if (poll) {
        // Small delay so React processes the setPolls state update before navigation
        await new Promise(r => setTimeout(r, 100));
        router.push(`/polls/${poll.id}`);
      }
      // Note: createPoll already shows a specific error toast on failure,
      // so we don't show a second one here to avoid duplicate/misleading messages.
    } finally {
      setSubmitting(false);
    }
  };

  const applyTemplate = (tpl: Template) => {
    setTitle(tpl.title);
    setCategory(tpl.category);
    setOptions(tpl.options);
    setDurationHours(tpl.duration);
    setUnitPrice(tpl.unitPrice);
    // Reset option images
    setOptionImageFiles(tpl.options.map(() => null));
    setOptionImagePreviews(tpl.options.map(() => null));
    setOptionImageErrors(tpl.options.map(() => null));
    toast.success(`Template applied — edit the fields!`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t("createAPoll")}</h1>
      <p className="text-gray-500 text-sm mb-4">{t("createPollSubtitle")}</p>

      {/* Quick Templates */}
      <TemplatePicker onApply={applyTemplate} />

      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
        {/* Main Poll Image (optional) */}
        <MainImageField
          imagePreview={imagePreview}
          imageUploading={imageUploading}
          imageError={imageError}
          handleImageSelect={handleImageSelect}
          handleImageRemove={handleImageRemove}
        />

        {/* Title / Description / Category */}
        <BasicDetailsFields
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          category={category}
          setCategory={setCategory}
        />

        {/* Options (labels + avatar images) */}
        <OptionsEditor
          options={options}
          optionImagePreviews={optionImagePreviews}
          optionImageErrors={optionImageErrors}
          updateOption={updateOption}
          removeOption={removeOption}
          addOption={addOption}
          handleOptionImageSelect={handleOptionImageSelect}
          handleOptionImageRemove={handleOptionImageRemove}
        />

        {/* Pricing / Creation fee / Preview / Balance / Submit */}
        <PricingSubmitSection
          unitPrice={unitPrice}
          setUnitPrice={setUnitPrice}
          durationHours={durationHours}
          setDurationHours={setDurationHours}
          submitting={submitting}
          imageUploading={imageUploading}
        />
      </form>
    </div>
  );
}
