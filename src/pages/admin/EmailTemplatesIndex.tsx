import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const templates = [
  {
    name: "Payment Failed",
    description: "Sent automatically when a recurring membership dues or annual fee payment fails (via Stripe webhook).",
    path: "/admin/email-templates/payment-failed",
  },
  {
    name: "Applicant Card Declined",
    description: "Sent automatically when an approved applicant's initial card charge declines. Reserves their approval for 7 days.",
    path: "/admin/email-templates/card-declined",
  },
];

export default function EmailTemplatesIndex() {
  const navigate = useNavigate();

  return (
    <AdminLayout title="Email Templates">
      <div className="space-y-4 max-w-4xl">
        <p className="text-sm text-muted-foreground">
          Preview the transactional emails sent to members and applicants. Click any template to see the live rendered version.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.path} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {t.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{t.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(t.path)}
                  className="w-full"
                >
                  Preview Email
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
