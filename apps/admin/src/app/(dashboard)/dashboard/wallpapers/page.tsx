"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api/client";
import { getCsrfToken } from "@/lib/api/client";
import { API_URL } from "@/lib/config";
import {
  Image,
  Upload,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Play,
  Film,
  X,
  Volume2,
  VolumeX,
  Maximize2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Wallpaper {
  id: string;
  nameAr: string;
  s3Key: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  isActive: boolean;
  sortOrder: number;
  url: string;
}

export default function WallpapersPage() {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [previewItem, setPreviewItem] = useState<Wallpaper | null>(null);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const fetchWallpapers = useCallback(async () => {
    try {
      const { data } = await api.get<Wallpaper[]>("/admin/wallpapers");
      setWallpapers(data);
    } catch {
      toast.error("Failed to load wallpapers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallpapers();
  }, [fetchWallpapers]);

  const uploadFile = useCallback(async (file: File) => {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Only images and videos are allowed");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large (max 50MB)");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("nameAr", file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    const uploadUrl = `${API_URL}/admin/wallpapers/upload`;

    return new Promise<void>((resolve, reject) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(pct);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          toast.success("Wallpaper uploaded successfully");
          fetchWallpapers();
          resolve();
        } else {
          let msg = "Upload failed";
          try {
            const err = JSON.parse(xhr.responseText);
            msg = err.message || msg;
          } catch { /* ignore */ }
          toast.error(msg);
          reject(new Error(msg));
        }
        setUploading(false);
        setUploadProgress(0);
        xhrRef.current = null;
        if (fileRef.current) fileRef.current.value = "";
      });

      xhr.addEventListener("error", () => {
        toast.error("Upload failed — check your network connection");
        setUploading(false);
        setUploadProgress(0);
        xhrRef.current = null;
        if (fileRef.current) fileRef.current.value = "";
        reject(new Error("Network error"));
      });

      xhr.addEventListener("abort", () => {
        toast.info("Upload cancelled");
        setUploading(false);
        setUploadProgress(0);
        xhrRef.current = null;
        if (fileRef.current) fileRef.current.value = "";
        resolve();
      });

      xhr.open("POST", uploadUrl);
      xhr.withCredentials = true;

      const csrfToken = getCsrfToken();
      if (csrfToken) {
        xhr.setRequestHeader("X-CSRF-Token", csrfToken);
      }

      xhr.send(formData);
    });
  }, [fetchWallpapers]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await uploadFile(file);
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
  };

  const toggleActive = async (w: Wallpaper) => {
    try {
      await api.patch(`/admin/wallpapers/${w.id}`, { isActive: !w.isActive });
      setWallpapers((prev) =>
        prev.map((item) => (item.id === w.id ? { ...item, isActive: !item.isActive } : item))
      );
      toast.success(w.isActive ? "Hidden" : "Activated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const deleteWallpaper = async (w: Wallpaper) => {
    if (!confirm(`Delete "${w.nameAr}"?`)) return;
    try {
      await api.delete(`/admin/wallpapers/${w.id}`);
      setWallpapers((prev) => prev.filter((item) => item.id !== w.id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const saveRename = async (w: Wallpaper) => {
    if (!editName.trim()) return;
    try {
      await api.patch(`/admin/wallpapers/${w.id}`, { nameAr: editName.trim() });
      setWallpapers((prev) =>
        prev.map((item) => (item.id === w.id ? { ...item, nameAr: editName.trim() } : item))
      );
      setEditingId(null);
      toast.success("Renamed");
    } catch {
      toast.error("Failed to rename");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const imageCount = wallpapers.filter((w) => w.fileType !== "video").length;
  const videoCount = wallpapers.filter((w) => w.fileType === "video").length;
  const activeCount = wallpapers.filter((w) => w.isActive).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
            <Image className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Form Wallpapers</h1>
            <p className="text-sm text-muted-foreground">
              Manage wallpapers available in the form builder
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {uploading && (
            <button
              onClick={cancelUpload}
              className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          )}
          <label className={`cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <span className="inline-flex items-center gap-2 rounded-4xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
              {uploading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Uploading... {uploadProgress}%
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Upload Wallpaper
                </>
              )}
            </span>
          </label>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {uploading && (
        <div className="rounded-4xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Uploading file...</span>
            <span className="font-semibold text-primary">{uploadProgress}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Drag & Drop Zone + Grid */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-6 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <div className="aspect-[16/10] bg-muted animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : wallpapers.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center py-24 text-center rounded-2xl border-2 border-dashed transition-all ${
            dragOver
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-muted-foreground/20 hover:border-muted-foreground/40"
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Upload className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold">No wallpapers yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Drag and drop images or videos here, or click &quot;Upload Wallpaper&quot;
          </p>
          <p className="text-xs text-muted-foreground/60 mt-3">
            Max size: 50MB · Formats: JPG, PNG, WebP, MP4, WebM
          </p>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`transition-all rounded-2xl ${dragOver ? "ring-2 ring-primary ring-offset-4 ring-offset-background" : ""}`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {wallpapers.map((w) => (
              <div
                key={w.id}
                className={`group relative rounded-4xl border bg-card overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                  w.isActive ? "border-border" : "border-dashed border-muted-foreground/30"
                }`}
              >
                {/* Preview */}
                <div
                  className="aspect-[16/12] m-2 rounded-4xl relative bg-muted cursor-pointer overflow-hidden"
                  onClick={() => setPreviewItem(w)}
                >
                  {w.fileType === "video" ? (
                    <>
                      <video
                        src={w.url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        onMouseOver={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                        onMouseOut={(e) => {
                          const v = e.target as HTMLVideoElement;
                          v.pause();
                          v.currentTime = 0;
                        }}
                      />
                      {/* Video play indicator */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Play className="h-4 w-4 text-white ml-0.5" fill="white" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={w.url}
                      alt={w.nameAr}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  )}

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    {w.fileType === "video" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-600/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-white">
                        <Film className="h-2.5 w-2.5" />
                        VIDEO
                      </span>
                    )}
                  </div>

                  {!w.isActive && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/90 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                        <EyeOff className="h-3 w-3" />
                        Hidden
                      </span>
                    </div>
                  )}

                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewItem(w); }}
                        className="rounded-lg bg-white/90 backdrop-blur-sm p-2 text-foreground hover:bg-white transition-colors shadow-sm"
                        title="Preview"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="flex gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleActive(w); }}
                          className="rounded-lg bg-white/90 backdrop-blur-sm p-2 text-foreground hover:bg-white transition-colors shadow-sm"
                          title={w.isActive ? "Hide" : "Show"}
                        >
                          {w.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteWallpaper(w); }}
                          className="rounded-lg bg-red-500/90 backdrop-blur-sm p-2 text-white hover:bg-red-600 transition-colors shadow-sm"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 space-y-1">
                  {editingId === w.id ? (
                    <div className="flex gap-1.5">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(w);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={() => setEditingId(null)}
                        className="flex-1 text-sm border rounded-lg px-2.5 py-1.5 bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <p
                      className="text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors"
                      onClick={() => {
                        setEditingId(w.id);
                        setEditName(w.nameAr);
                      }}
                      title="Click to rename"
                    >
                      {w.nameAr}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {formatSize(w.fileSize)} · {w.mimeType.split("/")[1]?.toUpperCase()}
                    </p>
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        w.isActive ? "bg-green-500" : "bg-muted-foreground/30"
                      }`}
                      title={w.isActive ? "Active" : "Hidden"}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] rounded-2xl overflow-hidden bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Content */}
            {previewItem.fileType === "video" ? (
              <div className="relative">
                <video
                  ref={previewVideoRef}
                  src={previewItem.url}
                  className="w-full max-h-[80vh] object-contain"
                  autoPlay
                  loop
                  playsInline
                  muted={previewMuted}
                  controls
                />
                <button
                  onClick={() => setPreviewMuted(!previewMuted)}
                  className="absolute bottom-4 left-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 flex items-center justify-center transition-colors"
                >
                  {previewMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <img
                src={previewItem.url}
                alt={previewItem.nameAr}
                className="w-full max-h-[80vh] object-contain"
              />
            )}

            {/* Info bar */}
            <div className="p-4 bg-gradient-to-t from-black/90 to-black/40 absolute bottom-0 left-0 right-0">
              <p className="text-white font-medium text-sm">{previewItem.nameAr}</p>
              <p className="text-white/60 text-xs mt-0.5">
                {formatSize(previewItem.fileSize)} · {previewItem.mimeType}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
