import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Link2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  userId: number;
  currentCustomSlug: string | null | undefined;
  currentSlug: string | null | undefined;
}

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function VanityUrlEditor({ userId, currentCustomSlug, currentSlug }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [input, setInput] = useState(currentCustomSlug ?? "");
  const [debouncedSlug, setDebouncedSlug] = useState("");
  const [dirty, setDirty] = useState(false);

  // Update input when prop changes (e.g., after save)
  useEffect(() => {
    setInput(currentCustomSlug ?? "");
    setDirty(false);
  }, [currentCustomSlug]);

  // Debounce check
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSlug(input.toLowerCase().trim()), 500);
    return () => clearTimeout(id);
  }, [input]);

  const slugToCheck = dirty && debouncedSlug.length >= 3 ? debouncedSlug : "";

  const { data: checkResult, isFetching: checking } = useQuery<{ available: boolean; reason?: string }>({
    queryKey: ["/api/slug/check", slugToCheck, userId],
    queryFn: async () => {
      if (!slugToCheck) return { available: true };
      const res = await fetch(`/api/slug/check?slug=${encodeURIComponent(slugToCheck)}&userId=${userId}`);
      return res.json();
    },
    enabled: slugToCheck.length >= 3,
    staleTime: 10_000,
  });

  const saveSlug = useMutation({
    mutationFn: async (slug: string | null) => {
      const res = await fetch("/api/freelancer/custom-slug", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/freelancer"] });
      queryClient.invalidateQueries({ queryKey: [`/api/freelancer/${userId}`] });
      setDirty(false);
      toast({ title: data.slug ? "Vanity URL saved!" : "Custom URL removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    setDirty(true);
  };

  const handleSave = () => {
    const slug = input.toLowerCase().trim() || null;
    if (slug && !SLUG_REGEX.test(slug)) return;
    saveSlug.mutate(slug);
  };

  const handleRemove = () => {
    setInput("");
    saveSlug.mutate(null);
  };

  const normalizedInput = input.toLowerCase().trim();
  const isValidFormat = normalizedInput === "" || SLUG_REGEX.test(normalizedInput);
  const isChecking = checking && dirty && normalizedInput.length >= 3;
  const isAvailable = !dirty || !normalizedInput || (checkResult?.available && isValidFormat);
  const showStatus = dirty && normalizedInput.length >= 3 && !isChecking;

  const displaySlug = currentCustomSlug || currentSlug;
  const profileBase = window.location.origin;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5" />
          Vanity Profile URL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose a custom short URL for your public profile. Visitors can reach you at{" "}
          <span className="font-medium text-foreground">{profileBase}/profile/</span>
          <span className="font-medium text-primary">{displaySlug || "your-name"}</span>.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              /profile/
            </span>
            <Input
              value={input}
              onChange={handleChange}
              placeholder={currentSlug ?? "your-name"}
              className="pl-[72px]"
              maxLength={30}
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={
              saveSlug.isPending ||
              (dirty && (isChecking || !checkResult?.available || !isValidFormat)) ||
              (!dirty && normalizedInput === (currentCustomSlug ?? ""))
            }
          >
            {saveSlug.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
          {currentCustomSlug && (
            <Button variant="outline" onClick={handleRemove} disabled={saveSlug.isPending}>
              Remove
            </Button>
          )}
        </div>

        {/* Availability status */}
        {isChecking && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking availability…
          </p>
        )}
        {showStatus && isValidFormat && checkResult?.available && (
          <p className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Available!
          </p>
        )}
        {showStatus && (!isValidFormat || (checkResult && !checkResult.available)) && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <XCircle className="h-3.5 w-3.5" />
            {!isValidFormat
              ? "3–30 characters, lowercase letters, numbers, and hyphens only."
              : checkResult?.reason}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Your auto-generated URL (<span className="font-mono">{currentSlug}</span>) will always work as a fallback.
        </p>
      </CardContent>
    </Card>
  );
}
