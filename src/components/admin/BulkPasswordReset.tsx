import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Key, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

const BulkPasswordReset = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resetResult, setResetResult] = useState<any>(null);

  const handleBulkPasswordReset = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to perform this operation",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResetResult(null);
    
    try {
      console.log('Initiating bulk password reset for admin:', user.id);
      
      const { data, error } = await supabase.functions.invoke('reset-all-passwords', {
        body: {
          adminUserId: user.id
        }
      });

      if (error) {
        console.error('Bulk password reset error:', error);
        throw error;
      }

      console.log('Bulk password reset result:', data);
      setResetResult(data);

      toast({
        title: "Password Reset Complete",
        description: `Successfully reset ${data.successCount} user passwords. All users must change their password on next login.`,
      });

    } catch (error: any) {
      console.error('Error during bulk password reset:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset user passwords",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
      <CardHeader>
        <CardTitle className="flex items-center text-orange-800 dark:text-orange-200">
          <Key className="w-5 h-5 mr-2" />
          Bulk Password Reset
        </CardTitle>
        <CardDescription className="text-orange-700 dark:text-orange-300">
          Reset all user passwords to a temporary password for security purposes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-orange-300 bg-orange-100 dark:border-orange-700 dark:bg-orange-900">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <strong>Warning:</strong> This action will reset ALL user passwords to "VestasTemp2025!" and require them to change their password on next login.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <h4 className="font-medium text-orange-800 dark:text-orange-200">This operation will:</h4>
          <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1 ml-4">
            <li>• Set all user passwords to: <strong>VestasTemp2025!</strong></li>
            <li>• Force all users to change their password on next login</li>
            <li>• Update password change requirements for all users</li>
            <li>• Generate a detailed report of the operation</li>
          </ul>
        </div>

        {resetResult && (
          <Alert className="border-green-300 bg-green-100 dark:border-green-700 dark:bg-green-900">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <div className="space-y-2">
                <div><strong>Reset Summary:</strong></div>
                <div>• Total Users: {resetResult.totalUsers}</div>
                <div>• Successfully Reset: {resetResult.successCount}</div>
                <div>• Errors: {resetResult.errorCount}</div>
                <div>• New Password: <code className="bg-green-200 dark:bg-green-800 px-1 rounded">VestasTemp2025!</code></div>
                {resetResult.errors && resetResult.errors.length > 0 && (
                  <div className="mt-2">
                    <div><strong>Errors:</strong></div>
                    <ul className="text-xs space-y-1">
                      {resetResult.errors.map((error: string, index: number) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              <Shield className="w-4 h-4 mr-2" />
              {loading ? "Resetting Passwords..." : "Reset All User Passwords"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center text-orange-800">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Confirm Bulk Password Reset
              </AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-3">
                  <p>
                    You are about to reset <strong>ALL USER PASSWORDS</strong> in the system to the temporary password "VestasTemp2025!".
                  </p>
                  <div className="bg-orange-50 p-3 rounded border border-orange-200">
                    <p className="text-sm font-medium text-orange-800">This action will:</p>
                    <ul className="text-sm text-orange-700 mt-1 space-y-1">
                      <li>• Immediately change every user's password</li>
                      <li>• Force password change on next login for all users</li>
                      <li>• Cannot be undone</li>
                    </ul>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Are you absolutely certain you want to proceed?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleBulkPasswordReset}
                className="bg-orange-600 hover:bg-orange-700"
                disabled={loading}
              >
                {loading ? "Processing..." : "Yes, Reset All Passwords"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default BulkPasswordReset;