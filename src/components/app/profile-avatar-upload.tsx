"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadProfilePhoto, initialsFromName, validateProfileImage } from "@/lib/profile-photo";
import { useAuth } from "@/components/providers/auth-provider";

type Props = {
  photoURL?: string | null;
  displayName: string;
  onPhotoUpdated: (url: string) => void;
  disabled?: boolean;
};

export function ProfileAvatarUpload({ photoURL, displayName, onPhotoUpdated, disabled }: Props) {
  const { user, refreshProfilePhoto } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const shownUrl = preview ?? photoURL ?? null;
  const initials = initialsFromName(displayName || user?.email || "?");

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    const validation = validateProfileImage(file);
    if (validation) {
      toast.error(validation);
      return;
    }

    let localPreview: string | null = null;
    setUploading(true);

    try {
      localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      const result = await uploadProfilePhoto(user.uid, file, user);
      setPreview(result.url);
      onPhotoUpdated(result.url);
      await refreshProfilePhoto();

      if (result.usedFirestoreFallback) {
        toast.success("Photo enregistrée", {
          description:
            "Mode sans Storage cloud. Ajoutez NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET pour un hébergement optimal.",
        });
      } else {
        toast.success("Photo de profil enregistrée");
      }
    } catch (err) {
      setPreview(photoURL ?? null);
      const msg = err instanceof Error ? err.message : "Échec du téléversement";
      toast.error(msg);
    } finally {
      if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative">
        <div
          className={cn(
            "flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 bg-muted text-2xl font-semibold text-muted-foreground",
            uploading && "opacity-60",
          )}
        >
          {shownUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <button
          type="button"
          disabled={disabled || uploading || !user}
          onClick={() => inputRef.current?.click()}
          className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border bg-primary text-primary-foreground shadow hover:opacity-90 disabled:opacity-50"
          aria-label="Changer la photo de profil"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 text-center sm:text-left">
        <p className="text-sm font-medium">Photo de profil</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          JPG, PNG ou WebP — maximum 2 Mo. Visible sur votre profil.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading || !user}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Envoi en cours…" : shownUrl ? "Changer la photo" : "Ajouter une photo"}
        </Button>
      </div>
    </div>
  );
}
