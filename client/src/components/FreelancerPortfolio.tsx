import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Film,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

type PostType = "photo" | "video" | "blog";

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
  photo: "Photo",
  video: "Video",
  blog: "Blog Post",
};

const TYPE_ICONS: Record<PostType, React.ReactNode> = {
  photo: <ImagePlus className="h-4 w-4" />,
  video: <Film className="h-4 w-4" />,
  blog: <FileText className="h-4 w-4" />,
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

  return (
    <Card className="overflow-hidden">
      {/* Media area */}
      {post.type !== "blog" && post.media_url && (
        <div className="relative aspect-video bg-muted">
          {post.type === "photo" ? (
            <img
              src={post.media_url}
              alt={post.title || "Portfolio photo"}
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              src={post.media_url}
              controls
              className="h-full w-full object-cover"
              poster={post.thumbnail_url || undefined}
            />
          )}
        </div>
      )}

      {post.type === "blog" && (
        <div className="flex h-24 items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <FileText className="h-10 w-10 text-purple-300" />
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              {TYPE_ICONS[post.type]}
              {TYPE_LABELS[post.type]}
            </div>
            {post.title && <p className="truncate font-semibold leading-tight">{post.title}</p>}
            {post.body && (
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{post.body}</p>
            )}
          </div>
          {editable && (
            <div className="relative shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMenuOpen((o) => !o)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-10 w-32 rounded-md border bg-popover py-1 shadow-lg">
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
      </CardContent>
    </Card>
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

  const [type, setType] = useState<PostType>(initial?.type || "photo");
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [mediaUrl, setMediaUrl] = useState(initial?.media_url || "");
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        type,
        title: title || null,
        body: body || null,
        media_url: mediaUrl || null,
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
      qc.invalidateQueries({ queryKey: ["/api/portfolio", userId] });
      toast({ title: initial ? "Post updated" : "Post created" });
      onClose();
    },
    onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/portfolio/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (data.url) setMediaUrl(data.url);
      else throw new Error("No URL returned");
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Type selector */}
      {!initial && (
        <div>
          <Label className="mb-2 block">Post type</Label>
          <div className="flex gap-2">
            {(["photo", "video", "blog"] as PostType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  type === t
                    ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {TYPE_ICONS[t]}
                {TYPE_LABELS[t]}
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
          placeholder={type === "blog" ? "Post title..." : "Caption (optional)"}
          className="mt-1"
        />
      </div>

      {/* Media upload for photo/video */}
      {type !== "blog" && (
        <div>
          <Label>{type === "photo" ? "Photo" : "Video"}</Label>
          <div className="mt-1 space-y-2">
            {mediaUrl ? (
              <div className="relative rounded-md border bg-muted p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-muted-foreground">
                    {mediaUrl.split("/").pop()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => setMediaUrl("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {type === "photo" && (
                  <img
                    src={mediaUrl}
                    alt="preview"
                    className="mt-2 max-h-40 rounded object-cover"
                  />
                )}
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-6 text-sm text-muted-foreground transition-colors hover:border-purple-400 hover:text-purple-600 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Click to upload{" "}
                    {type === "photo" ? "a photo" : "a video"}
                  </>
                )}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={type === "photo" ? "image/*" : "video/*"}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      )}

      {/* Body / text */}
      <div>
        <Label htmlFor="post-body">{type === "blog" ? "Content" : "Description"}</Label>
        <Textarea
          id="post-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={type === "blog" ? "Write your post here..." : "Add a description..."}
          rows={type === "blog" ? 8 : 3}
          className="mt-1"
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

export function FreelancerPortfolio({ userId, editable = false }: FreelancerPortfolioProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioPost | undefined>(undefined);
  const [filterType, setFilterType] = useState<PostType | "all">("all");

  const { data: posts = [], isLoading } = useQuery<PortfolioPost[]>({
    queryKey: ["/api/portfolio", userId],
    queryFn: () => apiRequest(`/api/portfolio?userId=${userId}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/portfolio/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/portfolio", userId] });
      toast({ title: "Post deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const filtered = filterType === "all" ? posts : posts.filter((p) => p.type === filterType);

  const openNew = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (post: PortfolioPost) => {
    setEditing(post);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-sm text-muted-foreground">
            Share your work — photos, videos, and blog posts
          </p>
        </div>
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

      {/* Filter tabs */}
      {posts.length > 0 && (
        <div className="flex gap-2">
          {(["all", "photo", "video", "blog"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                filterType === t
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "All" : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit post" : "New portfolio post"}</DialogTitle>
          </DialogHeader>
          <PostForm userId={userId} initial={editing} onClose={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
