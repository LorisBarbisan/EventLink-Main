import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useBooksAccess } from "@/hooks/useBooksAccess";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { shrinkPhoto } from "@/lib/books-mobile";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

/**
 * Photograph a receipt and file it later. A photo, a date and an optional
 * note — no amount, category or job: those are filled in at a desk.
 */
export default function Capture() {
  const { user } = useAuth();
  const access = useBooksAccess();
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [savedOne, setSavedOne] = useState(false);

  const { data: count } = useQuery<{ count: number }>({
    queryKey: ["/api/receipts/unattached/count"],
    enabled: access.state === "available",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error("No photo");
      const shrunk = await shrinkPhoto(photo);
      return apiRequest("/api/receipts", {
        method: "POST",
        body: JSON.stringify({
          fileData: shrunk.base64,
          filename: shrunk.name,
          contentType: shrunk.type,
          receipt_date: date,
          note: note.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/receipts/unattached/count"] });
      qc.invalidateQueries({ queryKey: ["/api/receipts/unattached"] });
      if (preview) URL.revokeObjectURL(preview);
      setPhoto(null);
      setPreview(null);
      setNote("");
      setDate(today());
      setSavedOne(true);
    },
    onError: () =>
      toast({
        title: "Couldn't save the receipt",
        description: "Check your signal and try again — the photo is still here.",
        variant: "destructive",
      }),
  });

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
    setSavedOne(false);
  };

  const waiting = count?.count ?? 0;

  let body: React.ReactNode;
  if (!user || access.state === "loading") {
    body = <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>;
  } else if (access.state !== "available") {
    body = (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Receipt capture is part of Books. Add your country in your profile to get started.
      </p>
    );
  } else {
    body = (
      <div className="space-y-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {!photo ? (
          <>
            {savedOne && (
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                <Check className="h-4 w-4" /> Saved. Another one?
              </p>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary active:bg-primary/10"
            >
              <Camera className="h-16 w-16" />
              <span className="text-lg font-semibold">Photograph a receipt</span>
            </button>
          </>
        ) : (
          <div className="space-y-4">
            {photo.type.startsWith("image/") && preview ? (
              <img
                src={preview}
                alt="Receipt"
                className="max-h-[45vh] w-full rounded-xl border object-contain"
              />
            ) : (
              <p className="rounded-xl border p-4 text-sm">{photo.name}</p>
            )}
            <div className="space-y-1">
              <Label htmlFor="cap-date">Date</Label>
              <Input
                id="cap-date"
                type="date"
                value={date}
                max={today()}
                onChange={(e) => setDate(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cap-note">Note (optional)</Label>
              <Input
                id="cap-note"
                value={note}
                maxLength={500}
                placeholder="e.g. Diesel, M6 services"
                onChange={(e) => setNote(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={() => inputRef.current?.click()}
                disabled={save.isPending}
              >
                Retake
              </Button>
              <Button
                className="h-12 flex-1"
                onClick={() => save.mutate()}
                disabled={save.isPending}
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {waiting === 0
            ? "No receipts waiting to be filed."
            : `${waiting} receipt${waiting === 1 ? "" : "s"} waiting to be filed.`}{" "}
          Capture here, file them later on a computer.
        </p>
        <p className="text-center">
          <Link href="/dashboard?tab=books" className="text-sm text-primary underline">
            Back to Books
          </Link>
        </p>
      </div>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-6">
        <h1 className="mb-1 text-xl font-bold">Capture a receipt</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          A photo and a date. Amount and category can wait.
        </p>
        {body}
      </div>
    </Layout>
  );
}
