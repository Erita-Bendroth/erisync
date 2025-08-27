import { useAuth } from "@/components/auth/AuthProvider";
import Layout from "@/components/Layout";
import { Navigate } from "react-router-dom";
import HolidayManager from "@/components/holidays/HolidayManager";

const Holidays = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Holiday Management</h1>
            <p className="text-muted-foreground text-lg">
              Import and manage public holidays for accurate scheduling. 
              For Germany, select your specific Bundesland to get region-specific holidays.
            </p>
          </div>
          
          <HolidayManager />
        </div>
      </div>
    </Layout>
  );
};

export default Holidays;