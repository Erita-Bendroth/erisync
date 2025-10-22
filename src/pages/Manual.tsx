import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { ManualLayout } from "@/components/manual/ManualLayout";
import { PlannerManual } from "@/components/manual/PlannerManual";
import { ManagerManual } from "@/components/manual/ManagerManual";
import { TeamMemberManual } from "@/components/manual/TeamMemberManual";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

const Manual = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<string>("");

  useEffect(() => {
    const fetchUserRoles = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) throw error;

        const userRoles = data.map((r) => r.role);
        setRoles(userRoles);
        
        // Set default active role based on hierarchy
        if (userRoles.includes("planner") || userRoles.includes("admin")) {
          setActiveRole("planner");
        } else if (userRoles.includes("manager")) {
          setActiveRole("manager");
        } else {
          setActiveRole("teammember");
        }
      } catch (error) {
        console.error("Error fetching roles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRoles();
  }, [user]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const hasMultipleRoles = roles.length > 1 || 
    roles.includes("planner") || 
    roles.includes("admin");

  const renderManualContent = (role: string) => {
    switch (role) {
      case "planner":
        return <PlannerManual />;
      case "manager":
        return <ManagerManual />;
      default:
        return <TeamMemberManual />;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">User Manual</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive guide to using the Employee Scheduler
          </p>
        </div>

        {hasMultipleRoles ? (
          <Tabs value={activeRole} onValueChange={setActiveRole}>
            <TabsList>
              {(roles.includes("planner") || roles.includes("admin")) && (
                <TabsTrigger value="planner">Planner Guide</TabsTrigger>
              )}
              {roles.includes("manager") && (
                <TabsTrigger value="manager">Manager Guide</TabsTrigger>
              )}
              <TabsTrigger value="teammember">Team Member Guide</TabsTrigger>
            </TabsList>

            <TabsContent value="planner">
              <ManualLayout role="planner">
                <PlannerManual />
              </ManualLayout>
            </TabsContent>

            <TabsContent value="manager">
              <ManualLayout role="manager">
                <ManagerManual />
              </ManualLayout>
            </TabsContent>

            <TabsContent value="teammember">
              <ManualLayout role="teammember">
                <TeamMemberManual />
              </ManualLayout>
            </TabsContent>
          </Tabs>
        ) : (
          <ManualLayout role={activeRole}>
            {renderManualContent(activeRole)}
          </ManualLayout>
        )}
      </div>
    </Layout>
  );
};

export default Manual;
