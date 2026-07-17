"use client";

import ImageUpload from "@/components/ImageUpload";
import { useLanguage } from "@/lib/languageContext";

interface MainImageFieldProps {
  imagePreview: string | null;
  imageUploading: boolean;
  imageError: string | null;
  handleImageSelect: (file: File) => void;
  handleImageRemove: () => void;
}

export default function MainImageField({
  imagePreview,
  imageUploading,
  imageError,
  handleImageSelect,
  handleImageRemove,
}: MainImageFieldProps) {
  const { t } = useLanguage();

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {t("pollImage")} <span className="text-gray-600">{t("optional")}</span>
      </label>
      <ImageUpload
        imagePreview={imagePreview}
        onFileSelect={handleImageSelect}
        onRemove={handleImageRemove}
        uploading={imageUploading}
        error={imageError}
      />
    </div>
  );
}
