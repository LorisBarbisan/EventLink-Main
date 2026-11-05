import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useHelpSettings } from "./useHelp";

/**
 * "Show tips and explanations" settings. Honoured instantly, no reload.
 * - master off            → mode "off" (nothing)
 * - master on + hover-only → mode "hover_only" (passive hints, no pop-ups)
 * - master on             → mode "full" (hints + occasional discovery prompts)
 */
export function HelpSettingsCard() {
  const { available, mode, setMode } = useHelpSettings();
  if (!available) return null;

  const on = mode !== "off";
  const hoverOnly = mode === "hover_only";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tips and explanations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="help-show">Show tips and explanations</Label>
            <p className="text-sm text-muted-foreground">
              Short hints on controls, and the occasional pointer to a feature you might have
              missed.
            </p>
          </div>
          <Switch
            id="help-show"
            checked={on}
            onCheckedChange={(v) => setMode(v ? "full" : "off")}
          />
        </div>

        {on && (
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <div className="space-y-0.5">
              <Label htmlFor="help-hover-only">Only when I hover</Label>
              <p className="text-sm text-muted-foreground">
                Keep the on-demand hints, but never let a tip open by itself.
              </p>
            </div>
            <Switch
              id="help-hover-only"
              checked={hoverOnly}
              onCheckedChange={(v) => setMode(v ? "hover_only" : "full")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
