import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getEmbedUrl, getVideoThumbnail } from "@/lib/video-embed";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Film,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

type PostType = "photo" | "video";

interface PortfolioPost {
  id: number;
  user_id: number;
  type: PostType;
  title: string | null;
  body: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

interface FreelancerPortfolioProps {
  userId: number;
  editable?: boolean;
}

const TYPE_LABELS: Record<PostType, string> = {
  photo: "Photos",
  video: "Videos",
};

const TYPE_ICONS: Record<PostType, React.ReactNode> = {
  photo: <ImagePlus className="h-4 w-4" />,
  video: <Film className="h-4 w-4" />,
};

function PostCard({
  post,
  editable,
  onEdit,
  onDelete,
}: {
  post: PortfolioPost;
  editable?: boolean;
  onEdit: (post: PortfolioPost) => void;
  onDelete: (id: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const thumbnail =
    post.type === "video"
      ? (post.thumbnail_url ?? getVideoThumbnail(post.media_url ?? "") ?? null)
      : post.media_url;

  const handleClick = () => {
    if (post.type === "video" && post.media_url) {
      window.open(post.media_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
      onClick={post.type === "video" ? handleClick : undefined}
    >
      {/* Media area */}
      <div className="aspect-video w-full overflow-hidden rounded-t-2xl bg-muted">
        {post.type === "photo" && post.media_url ? (
          <img
            src={post.media_url}
            alt={post.title || "Portfolio photo"}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : post.type === "video" ? (
          <div className="relative h-full w-full">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={post.title || "Video thumbnail"}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neutral-900" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60">
                <Play className="h-5 w-5 fill-white text-white" style={{ marginLeft: 3 }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <ImagePlus className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Text content */}
      <div className="p-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            {post.title && <p className="truncate text-sm font-bold leading-snug">{post.title}</p>}
            {post.body && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{post.body}</p>
            )}
          </div>
          {editable && (
            <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMenuOpen((o) => !o)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-50 w-32 rounded-md border bg-popover py-1 shadow-lg">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(post);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-muted"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(post.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostForm({
  userId,
  initial,
  onClose,
}: {
  userId: number;
  initial?: PortfolioPost;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<PostType>(
    initial?.type === "photo" || initial?.type === "video" ? initial.type : "photo"
  );
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [mediaUrl, setMediaUrl] = useState(initial?.media_url || "");
  const [uploading, setUploading] = useState(false);

  const embedUrl = type === "video" ? getEmbedUrl(mediaUrl) : null;
  const derivedThumbnail = type === "video" ? getVideoThumbnail(mediaUrl) : null;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        type,
        title: title || null,
        body: body || null,
        media_url: mediaUrl || null,
        thumbnail_url: type === "video" ? derivedThumbnail || null : null,
      };
      if (initial) {
        return apiRequest(`/api/portfolio/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiRequest("/api/portfolio", {
        method: "POST",
        body: JSON.stringify({ ...payload, user_id: userId }),
      });
    },
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ["/api/portfolio", userId] });
      toast({ title: initial ? "Post updated" : "Post published" });
      onClose();
    },
    onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
  });

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const blobUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);
        const MAX_W = 1200;
        const MAX_H = 900;
        let { width, height } = img;
        if (width > MAX_W || height > MAX_H) {
          const ratio = Math.min(MAX_W / width, MAX_H / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/webp", 0.85));
      };
      img.onerror = reject;
      img.src = blobUrl;
    });

  const handlePhotoFile = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      setMediaUrl(compressed);
    } catch {
      toast({ title: "Could not process image", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Type selector */}
      {!initial && (
        <div>
          <Label className="mb-2 block">Type</Label>
          <div className="flex gap-2">
            {(["photo", "video"] as PostType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setType(t);
                  setMediaUrl("");
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  type === t
                    ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {TYPE_ICONS[t]}
                {TYPE_LABELS[t].replace(/s$/, "")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Title */}
      <div>
        <Label htmlFor="post-title">Title</Label>
        <Input
          id="post-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Caption (optional)"
          className="mt-1"
        />
      </div>

      {/* Photo upload */}
      {type === "photo" && (
        <div>
          <Label>Photo</Label>
          <div className="mt-1 space-y-2">
            {mediaUrl ? (
              <div className="relative overflow-hidden rounded-lg border bg-muted">
                <img src={mediaUrl} alt="preview" className="max-h-52 w-full object-cover" />
                <button
                  onClick={() => setMediaUrl("")}
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-6 text-sm text-muted-foreground transition-colors hover:border-purple-400 hover:text-purple-600 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Click to upload a photo
                  </>
                )}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhotoFile(f);
              }}
            />
          </div>
        </div>
      )}

      {/* Video embed URL */}
      {type === "video" && (
        <div className="space-y-2">
          <Label htmlFor="video-url">Video URL</Label>
          <Input
            id="video-url"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="Paste YouTube or Vimeo URL…"
            className="mt-1"
          />
          {mediaUrl && !embedUrl && (
            <p className="text-xs text-destructive">Paste a YouTube or Vimeo link to preview.</p>
          )}
          {embedUrl && (
            <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                src={embedUrl}
                className="h-full w-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title="Video preview"
              />
            </div>
          )}
        </div>
      )}

      {/* Description */}
      <div>
        <Label htmlFor="post-body">Description</Label>
        <textarea
          id="post-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a description…"
          rows={3}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || uploading}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initial ? "Save changes" : "Publish"}
        </Button>
      </div>
    </div>
  );
}

export function FreelancerPortfolio({
  userId,
  editable = false,
  hideWhenEmpty = false,
}: FreelancerPortfolioProps & { hideWhenEmpty?: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioPost | undefined>(undefined);
  const [filterType, setFilterType] = useState<PostType | "all">("all");

  const {
    data: rawPosts = [],
    isLoading,
    isError,
  } = useQuery<PortfolioPost[]>({
    queryKey: ["/api/portfolio", userId],
    queryFn: () => apiRequest(`/api/portfolio?userId=${userId}`),
  });

  // Filter out legacy blog posts from the UI
  const posts = rawPosts.filter((p) => p.type === "photo" || p.type === "video");

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/portfolio/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ["/api/portfolio", userId] });
      toast({ title: "Post deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const filtered = filterType === "all" ? posts : posts.filter((p) => p.type === filterType);

  if (hideWhenEmpty && !isLoading && posts.length === 0) return null;

  const openNew = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (post: PortfolioPost) => {
    setEditing(post);
    setDialogOpen(true);
  };

  const TAB_LABELS: Record<"all" | PostType, string> = {
    all: "All",
    photo: "Photos",
    video: "Videos",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold">Portfolio</h2>
        {editable && (
          <Button
            onClick={openNew}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Post
          </Button>
        )}
      </div>

      {/* Subtabs */}
      <div className="mb-5 flex gap-1 border-b border-border">
        {(["all", "photo", "video"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              filterType === t
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Could not load portfolio. Please try again.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
          <ImagePlus className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">
            {posts.length === 0 ? "No posts yet" : "Nothing in this category"}
          </p>
          {editable && posts.length === 0 && (
            <Button variant="outline" className="mt-4" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first post
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              editable={editable}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit post" : "New portfolio post"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto pr-1">
            <PostForm userId={userId} initial={editing} onClose={() => setDialogOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
