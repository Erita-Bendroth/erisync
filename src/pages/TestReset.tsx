import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TestReset = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password Route Test</CardTitle>
        </CardHeader>
        <CardContent>
          <p>✅ The /reset-password route is working correctly!</p>
          <p className="text-sm text-muted-foreground mt-2">
            Current URL: {window.location.href}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestReset;