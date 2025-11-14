import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Loader2, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Recommendation {
  start_date: string;
  end_date: string;
  reason: string;
  confidence: number;
  considerations?: string;
}

interface RecommendationEngineProps {
  teams: Array<{ id: string; name: string }>;
  dateRange: { start: Date; end: Date };
}

export const RecommendationEngine = ({ teams, dateRange }: RecommendationEngineProps) => {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadTeamMembers = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          user_id,
          profiles!team_members_user_id_fkey(first_name, last_name)
        `)
        .eq('team_id', teamId);

      if (error) throw error;

      const members = data?.map(tm => ({
        id: tm.user_id,
        name: `${tm.profiles?.first_name} ${tm.profiles?.last_name}`
      })) || [];

      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive"
      });
    }
  };

  const handleTeamChange = (teamId: string) => {
    setSelectedTeam(teamId);
    setSelectedUserId('');
    setRecommendations([]);
    loadTeamMembers(teamId);
  };

  const generateRecommendations = async () => {
    if (!selectedTeam || !selectedUserId) {
      toast({
        title: "Missing Information",
        description: "Please select both team and user",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Get fresh session and explicitly pass the token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        toast({
          title: "Authentication Required",
          description: "Please log in to use this feature. Try refreshing the page.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      
      console.log('Calling vacation-recommendations with fresh session');
      
      const { data, error } = await supabase.functions.invoke('vacation-recommendations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          teamIds: [selectedTeam],
          userId: selectedUserId,
          dateRange: {
            start: format(dateRange.start, 'yyyy-MM-dd'),
            end: format(dateRange.end, 'yyyy-MM-dd')
          }
        }
      });

      if (error) throw error;

      setRecommendations(data.recommendations || []);
      
      toast({
        title: "Recommendations Generated",
        description: `Found ${data.recommendations?.length || 0} optimal vacation windows`
      });
    } catch (error: any) {
      console.error('Error generating recommendations:', error);
      
      let errorMessage = 'Failed to generate recommendations';
      let errorDetails = '';
      
      if (error.message?.includes('Rate limit')) {
        errorMessage = 'Rate limit exceeded';
        errorDetails = 'Please try again in a moment.';
      } else if (error.message?.includes('Payment required')) {
        errorMessage = 'AI usage limit reached';
        errorDetails = 'Please add credits to continue.';
      } else if (error.message) {
        errorMessage = 'Recommendation Error';
        errorDetails = error.message;
      }
      
      // Also log the full error for debugging
      console.log('Full error object:', JSON.stringify(error, null, 2));
      
      toast({
        title: errorMessage,
        description: errorDetails || 'An unexpected error occurred. Check console for details.',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return <Badge variant="default">High Confidence</Badge>;
    if (confidence >= 60) return <Badge variant="secondary">Medium Confidence</Badge>;
    return <Badge variant="outline">Low Confidence</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Smart Recommendations
        </CardTitle>
        <CardDescription>
          AI-powered vacation date suggestions based on capacity and fairness
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selection Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Team</label>
            <Select value={selectedTeam} onValueChange={handleTeamChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Team Member</label>
            <Select 
              value={selectedUserId} 
              onValueChange={setSelectedUserId}
              disabled={!selectedTeam}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={generateRecommendations} 
          disabled={loading || !selectedTeam || !selectedUserId}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 mr-2" />
              Generate Recommendations
            </>
          )}
        </Button>

        {/* Recommendations List */}
        {recommendations.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <div className="text-sm font-medium">
              Recommended Vacation Windows ({recommendations.length})
            </div>
            {recommendations.map((rec, index) => (
              <Alert key={index}>
                <Calendar className="h-4 w-4" />
                <AlertTitle className="flex items-center justify-between">
                  <span>
                    {format(parseISO(rec.start_date), 'MMM d')} - {format(parseISO(rec.end_date), 'MMM d, yyyy')}
                  </span>
                  {getConfidenceBadge(rec.confidence)}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-sm">{rec.reason}</p>
                  {rec.considerations && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Note:</span> {rec.considerations}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" variant="outline">
                      Create Draft Request
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {recommendations.length === 0 && !loading && (
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>No Recommendations Yet</AlertTitle>
            <AlertDescription>
              Select a team and team member to generate AI-powered vacation recommendations.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
