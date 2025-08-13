import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, Users, FileText, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ParsedUser {
  employeeId?: string;
  email: string;
  role: string;
  teamId?: string;
  teamName?: string;
  managerEmail?: string;
  isActive?: boolean;
}

interface ParsedTeam {
  teamId: string;
  teamName: string;
  managerEmail?: string;
}

interface ImportResults {
  users: { created: number; updated: number; errors: string[] };
  teams: { created: number; updated: number; errors: string[] };
  roles: { created: number; errors: string[] };
  teamMembers: { created: number; errors: string[] };
}

const BulkUserImport = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [parsedTeams, setParsedTeams] = useState<ParsedTeam[]>([]);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);

  const parseCSV = (csvContent: string, type: 'users' | 'teams'): ParsedUser[] | ParsedTeam[] => {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    if (type === 'users') {
      return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const userData: ParsedUser = {
          email: '',
          role: 'teammember'
        };

        headers.forEach((header, index) => {
          const value = values[index] || '';
          switch (header.toLowerCase()) {
            case 'employeeid':
              userData.employeeId = value;
              break;
            case 'email':
              userData.email = value;
              break;
            case 'role':
              userData.role = value;
              break;
            case 'teamid':
              userData.teamId = value;
              break;
            case 'team':
            case 'teamname':
              userData.teamName = value;
              break;
            case 'manageremail':
              userData.managerEmail = value;
              break;
            case 'isactive':
              userData.isActive = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
              break;
          }
        });

        return userData;
      });
    } else {
      return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const teamData: ParsedTeam = {
          teamId: '',
          teamName: ''
        };

        headers.forEach((header, index) => {
          const value = values[index] || '';
          switch (header.toLowerCase()) {
            case 'teamid':
              teamData.teamId = value;
              break;
            case 'teamname':
              teamData.teamName = value;
              break;
            case 'manageremail':
              teamData.managerEmail = value;
              break;
          }
        });

        return teamData;
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'users' | 'teams') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = parseCSV(content, type);
        
        if (type === 'users') {
          setParsedUsers(parsed as ParsedUser[]);
          toast({
            title: "Users CSV Parsed",
            description: `Found ${parsed.length} users to import`,
          });
        } else {
          setParsedTeams(parsed as ParsedTeam[]);
          toast({
            title: "Teams CSV Parsed", 
            description: `Found ${parsed.length} teams to import`,
          });
        }
      } catch (error) {
        toast({
          title: "Error parsing CSV",
          description: "Please check your CSV format",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    if (parsedUsers.length === 0) {
      toast({
        title: "No users to import",
        description: "Please upload a users CSV file first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-import-users', {
        body: {
          users: parsedUsers,
          teams: parsedTeams
        }
      });

      if (error) throw error;

      setImportResults(data.results);
      
      toast({
        title: "Import Completed",
        description: `Created ${data.results.users.created} users, ${data.results.teams.created} teams`,
      });

    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Bulk User Import
          </CardTitle>
          <CardDescription>
            Import users and teams from CSV files without sending email confirmations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="users-csv">Users CSV File</Label>
              <Input
                id="users-csv"
                type="file"
                accept=".csv"
                onChange={(e) => handleFileUpload(e, 'users')}
              />
              <p className="text-xs text-muted-foreground">
                Expected columns: EmployeeID, Email, Role, TeamID/TeamName
              </p>
              {parsedUsers.length > 0 && (
                <Badge variant="secondary">
                  <Users className="w-3 h-3 mr-1" />
                  {parsedUsers.length} users parsed
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="teams-csv">Teams CSV File (Optional)</Label>
              <Input
                id="teams-csv"
                type="file"
                accept=".csv"
                onChange={(e) => handleFileUpload(e, 'teams')}
              />
              <p className="text-xs text-muted-foreground">
                Expected columns: TeamID, TeamName, ManagerEmail
              </p>
              {parsedTeams.length > 0 && (
                <Badge variant="secondary">
                  <FileText className="w-3 h-3 mr-1" />
                  {parsedTeams.length} teams parsed
                </Badge>
              )}
            </div>
          </div>

          {/* Preview Section */}
          {parsedUsers.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Preview (First 5 users):</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {parsedUsers.slice(0, 5).map((user, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                    <div>
                      <span className="font-medium">{user.email}</span>
                      {user.employeeId && <span className="text-muted-foreground"> ({user.employeeId})</span>}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{user.role}</Badge>
                      {user.teamName && <Badge variant="secondary">{user.teamName}</Badge>}
                    </div>
                  </div>
                ))}
                {parsedUsers.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    ... and {parsedUsers.length - 5} more users
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Important Notes */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Users will be created with temporary passwords and NO email confirmations will be sent. 
              You'll need to provide login credentials to users separately.
            </AlertDescription>
          </Alert>

          {/* Import Button */}
          <Button 
            onClick={executeImport} 
            disabled={loading || parsedUsers.length === 0}
            className="w-full"
          >
            {loading ? "Importing..." : `Import ${parsedUsers.length} Users`}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {importResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{importResults.users.created}</div>
                <div className="text-sm text-muted-foreground">Users Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{importResults.teams.created}</div>
                <div className="text-sm text-muted-foreground">Teams Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{importResults.roles.created}</div>
                <div className="text-sm text-muted-foreground">Roles Assigned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{importResults.teamMembers.created}</div>
                <div className="text-sm text-muted-foreground">Team Members Added</div>
              </div>
            </div>

            {/* Errors Section */}
            {(importResults.users.errors.length > 0 || importResults.teams.errors.length > 0) && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center">
                  <XCircle className="w-4 h-4 mr-2 text-red-500" />
                  Errors
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {[...importResults.users.errors, ...importResults.teams.errors, ...importResults.roles.errors].map((error, index) => (
                    <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkUserImport;