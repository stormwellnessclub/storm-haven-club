import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function CardDeclinedEmailPreview() {
  const navigate = useNavigate();

  return (
    <AdminLayout title="Email Template Preview">
      <div className="space-y-4 max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Applicant Card-Declined Email</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sent automatically when an approved applicant's card declines during the initial admin charge.
              NOT sent for recurring membership dues failures.
            </p>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-white">
              <iframe
                srcDoc={getEmailHtml("Nicole")}
                className="w-full min-h-[900px] border-0"
                title="Card Declined Email Preview"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function getEmailHtml(firstName: string) {
  const BASE_URL = "https://stormwellnessclub.com";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;">
<div style="font-family:Georgia,'Times New Roman',Times,serif;max-width:600px;margin:0 auto;padding:0;">
  <div style="background:#DEDACE;padding:40px 30px;text-align:center;">
    <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:2px;color:#1C170F;">STORM WELLNESS CLUB</div>
  </div>
  <div style="height:4px;background:linear-gradient(90deg,#B8A068,#C1B19C,#B8A068);"></div>
  <div style="background:#ffffff;padding:30px;border-left:1px solid #C1B19C;border-right:1px solid #C1B19C;font-family:Georgia,serif;">
    <h2 style="color:#1C170F;margin-top:0;font-weight:500;">Dear ${firstName},</h2>
    <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;">Wonderful news — your Storm Wellness Club application has been approved. We're looking forward to welcoming you into the Club.</p>
    <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;">Before we can complete your activation, we ran into a small issue: your card on file was declined when we attempted your initial charge. This is typically due to a daily limit, an expired card, or a routine fraud check from your bank — nothing to be concerned about.</p>
    <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:10px;"><strong>To complete your activation, please update your payment method:</strong></p>
    <div style="text-align:center;margin:20px 0 30px;">
      <a href="${BASE_URL}/portal/payment-methods" style="display:inline-block;background:#1C170F;color:#DEDACE;padding:14px 32px;text-decoration:none;border-radius:4px;font-weight:600;letter-spacing:0.5px;">Update Payment Method</a>
    </div>
    <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:20px;margin:25px 0;">
      <p style="margin:0;font-weight:600;color:#92400e;font-size:15px;">⏰ Your approval is reserved for the next 7 days. If we don't receive a valid payment method by then, your approval will expire and a new application will be required to rejoin.</p>
    </div>
    <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;">Questions? Just reply to this email or give the Club a call — we're happy to help. To update your card, please use the secure link above.</p>
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <p style="font-style:italic;color:#6b7280;margin-bottom:5px;">Warmly,</p>
      <p style="font-weight:600;color:#1f2937;margin:0;">The Storm Wellness Club Team</p>
    </div>
  </div>
  <div style="height:1px;background:#C1B19C;"></div>
  <div style="background:#1C170F;padding:25px;text-align:center;color:#DEDACE;font-family:Georgia,serif;">
    <p style="color:#B8A068;font-size:14px;margin:0;">Storm Wellness Club</p>
  </div>
</div>
</body></html>`;
}
