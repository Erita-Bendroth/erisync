import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Handshake, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useOpenShiftRequests } from "@/hooks/useOpenShiftRequests";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

const SHIFT_LABEL: Record<string, string> = {
  early: "Early (E)",
  late: "Late (L)",
  night: "Night (N)",
};

interface Props {
  teamIds: string[];
}

export function OpenShiftRequestsPanel({ teamIds }: Props) {
  const { requests, claim, cancel } = useOpenShiftRequests(teamIds);
  const { user } = useAuth();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (requests.length === 0) return null;

  const handleClaim = async (id: string) => {
    setBusyId(id);
    const res = await claim(id);
    setBusyId(null);
    if (res.ok) toast({ title: "Shift claimed", description: "The shift has been added to your schedule." });
    else toast({ title: "Could not claim", description: res.error, variant: "destructive" });
  };

  const handleCancel = async (id: string) => {
    setBusyId(id);
    const res = await cancel(id);
    setBusyId(null);
    if (res.ok) toast({ title: "Request cancelled" });
    else toast({ title: "Could not cancel", description: res.error, variant: "destructive" });
  };

  return (
    <Card className="border-orange-300 dark:border-orange-700 bg-orange-50/40 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Handshake className="h-4 w-4 text-orange-600" />
          Open shift coverage requests ({requests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {requests.map((r) => {
          const isOwn = user?.id === r.created_by;
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="font-mono">
                  {SHIFT_LABEL[r.shift_type] ?? r.shift_type}
                </Badge>
                <span className="font-medium">
                  {format(parseISO(r.shift_date), "EEE, MMM d yyyy")}
                </span>
                {r.notes && (
                  <span className="text-xs text-muted-foreground">{r.notes}</span>
                )}
              </div>
              <div className="flex gap-2">
                {isOwn ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === r.id}
                    onClick={() => handleCancel(r.id)}
                  >
                    Cancel request
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => handleClaim(r.id)}
                  >
                    {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Take this shift"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}