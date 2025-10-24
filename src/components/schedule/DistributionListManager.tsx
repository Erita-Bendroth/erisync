import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DistributionListManagerProps {
  distributionList: string[];
  onUpdate: (list: string[]) => void;
}

export function DistributionListManager({ distributionList, onUpdate }: DistributionListManagerProps) {
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState("");

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;

    if (!validateEmail(trimmed)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }

    if (distributionList.includes(trimmed)) {
      toast({ title: "Duplicate Email", description: "This email is already in the list", variant: "destructive" });
      return;
    }

    onUpdate([...distributionList, trimmed]);
    setNewEmail("");
  };

  const removeEmail = (email: string) => {
    onUpdate(distributionList.filter(e => e !== email));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail();
    }
  };

  return (
    <div className="space-y-3">
      <Label>Distribution List ({distributionList.length} recipients)</Label>
      <div className="flex gap-2">
        <Input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="email@example.com"
        />
        <Button onClick={addEmail} type="button">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
        {distributionList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recipients added yet</p>
        ) : (
          distributionList.map(email => (
            <Badge key={email} variant="secondary" className="flex items-center gap-1">
              {email}
              <button
                onClick={() => removeEmail(email)}
                className="ml-1 hover:text-destructive"
                type="button"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
