import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Clock, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Checking authentication status</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Employee Scheduler</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Manage your team's shifts, vacation, and availability with ease
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/auth")} 
              size="lg"
              className="px-8"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              onClick={() => navigate("/contact")} 
              variant="outline"
              size="lg"
              className="px-8"
            >
              Contact Us
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader className="text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-primary" />
              <CardTitle>Schedule Management</CardTitle>
              <CardDescription>
                 Track shifts, vacation, other leave, and special assignments
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-primary" />
              <CardTitle>Role-Based Access</CardTitle>
              <CardDescription>
                Different views for managers, planners, and team members
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-primary" />
              <CardTitle>Real-Time Updates</CardTitle>
              <CardDescription>
                See availability and schedule changes as they happen
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Role-Based Permissions</CardTitle>
            <CardDescription>
              Different access levels ensure the right people see the right information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold mb-2 text-green-600">Managers</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• View full team details</li>
                  <li>• Manage team member schedules</li>
                  <li>• See availability of other teams</li>
                   <li>• Input other/vacation time</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-blue-600">Planners</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Full access to all teams</li>
                  <li>• Manage all activities</li>
                  <li>• Assign hotline support</li>
                  <li>• Create and modify teams</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-gray-600">Team Members</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• View team availability</li>
                  <li>• See who's available/busy</li>
                  <li>• Limited activity details</li>
                  <li>• Read-only access</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-16">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/privacy-policy")} 
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
            >
              Privacy Policy
            </Button>
            <Button 
              onClick={() => navigate("/contact")} 
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
            >
              Contact
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;