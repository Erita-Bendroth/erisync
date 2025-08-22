import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SecurityPolicy = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Security Policy</h1>
            <p className="text-muted-foreground mt-2">Last updated: August 22, 2025</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p>EriSync is committed to maintaining the highest security standards for our employee scheduling platform.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Measures</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-6 space-y-2">
                <li>End-to-end encryption for all data transmission</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Strict access controls and authentication mechanisms</li>
                <li>Compliance with industry security standards</li>
                <li>Regular security updates and patches</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Protection</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-6 space-y-2">
                <li>All user data is encrypted at rest and in transit</li>
                <li>Regular backups with secure storage</li>
                <li>GDPR and privacy regulation compliance</li>
                <li>Limited data retention policies</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Incident Response</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-6 space-y-2">
                <li>24/7 security monitoring</li>
                <li>Rapid response to security incidents</li>
                <li>Transparent communication about security issues</li>
                <li>Regular security training for all staff</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <p>For security concerns, please contact: <a href="mailto:security@erisync.xyz" className="text-primary hover:underline">security@erisync.xyz</a></p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default SecurityPolicy;