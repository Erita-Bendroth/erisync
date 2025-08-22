import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>1. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Personal Information</h4>
                <p className="text-muted-foreground">
                  We collect information you provide directly to us, including:
                </p>
                <ul className="list-disc pl-6 mt-2 text-muted-foreground space-y-1">
                  <li>Email address and password for account creation</li>
                  <li>Name and profile information</li>
                  <li>Schedule and availability data</li>
                  <li>Team membership and role information</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Usage Information</h4>
                <p className="text-muted-foreground">
                  We automatically collect certain information about your use of our service, including:
                </p>
                <ul className="list-disc pl-6 mt-2 text-muted-foreground space-y-1">
                  <li>Login times and session duration</li>
                  <li>Features used and actions performed</li>
                  <li>Device and browser information</li>
                  <li>IP address and location data</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Provide and maintain our scheduling service</li>
                <li>Authenticate users and manage accounts</li>
                <li>Process and display schedule information</li>
                <li>Send notifications about schedule changes</li>
                <li>Improve our service and develop new features</li>
                <li>Ensure security and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Data Storage and Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Data Storage</h4>
                <p className="text-muted-foreground">
                  Your data is securely stored using Supabase, a cloud-based database service. 
                  All data is encrypted in transit and at rest using industry-standard encryption protocols.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Security Measures</h4>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Row Level Security (RLS) policies to protect user data</li>
                  <li>Encrypted database connections (SSL/TLS)</li>
                  <li>Regular security audits and monitoring</li>
                  <li>Access controls and authentication systems</li>
                  <li>Data validation and sanitization</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Third-Party Services</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                We use the following third-party services:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Supabase:</strong> Database and authentication services
                </li>
                <li>
                  <strong>Resend:</strong> Email delivery service for notifications
                </li>
                <li>
                  <strong>Microsoft Outlook:</strong> Calendar integration (optional)
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                These services have their own privacy policies that govern their use of your information.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Cookies and Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                We use cookies and similar technologies to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Maintain your login session</li>
                <li>Remember your preferences and settings</li>
                <li>Analyze usage patterns and improve our service</li>
                <li>Ensure security and prevent fraud</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                You can control cookies through your browser settings, but disabling them may affect functionality.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Your Rights Under GDPR</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                If you are located in the European Union, you have the following rights:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Right to Access:</strong> You can request a copy of your personal data
                </li>
                <li>
                  <strong>Right to Rectification:</strong> You can request correction of inaccurate data
                </li>
                <li>
                  <strong>Right to Erasure:</strong> You can request deletion of your personal data
                </li>
                <li>
                  <strong>Right to Portability:</strong> You can request your data in a portable format
                </li>
                <li>
                  <strong>Right to Restrict Processing:</strong> You can request limitation of data processing
                </li>
                <li>
                  <strong>Right to Object:</strong> You can object to certain types of processing
                </li>
                <li>
                  <strong>Right to Withdraw Consent:</strong> You can withdraw consent at any time
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                To exercise these rights, please contact us using the information in the Contact section.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Data Retention</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We retain your personal information for as long as necessary to provide our services 
                and fulfill the purposes outlined in this policy. Schedule data may be retained for 
                historical reporting purposes. You can request deletion of your account and associated 
                data at any time.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Our service is not intended for children under 16 years of age. We do not knowingly 
                collect personal information from children under 16. If you believe we have collected 
                information from a child under 16, please contact us immediately.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Changes to This Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any 
                material changes by posting the new policy on this page and updating the "Last updated" 
                date. Your continued use of the service after such changes constitutes acceptance of 
                the updated policy.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>10. Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy or wish to exercise your rights, 
                please contact us:
              </p>
              <div className="bg-muted p-4 rounded-md">
                <p className="font-medium">Email: erbet@vestas.com</p>
                <p className="text-muted-foreground mt-2">
                  We will respond to your inquiry within 30 days.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;