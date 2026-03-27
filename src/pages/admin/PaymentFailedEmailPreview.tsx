import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PaymentFailedEmailPreview() {
  const navigate = useNavigate();

  // This is the same HTML template from the send-email edge function, rendered with sample data
  const sampleName = "Shireen";
  const sampleAmount = "$175.00";
  const sampleFailureReason = "Card declined — insufficient funds";
  const sampleNextRetry = "April 5, 2026";

  return (
    <AdminLayout title="Email Template Preview">
      <div className="space-y-4 max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Payment Failed Email Template</CardTitle>
            <p className="text-sm text-muted-foreground">
              This is what members receive when their payment fails. Sent automatically via Stripe webhook.
            </p>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-white">
              <iframe
                srcDoc={getEmailHtml(sampleName, sampleAmount, sampleFailureReason, sampleNextRetry)}
                className="w-full min-h-[800px] border-0"
                title="Payment Failed Email Preview"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function getEmailHtml(name: string, amount: string, failureReason: string, nextRetry: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  
  <!-- Header -->
  <div style="background:#312D28;padding:30px 25px;text-align:center;">
    <h1 style="color:#E8DED1;margin:0;font-size:24px;letter-spacing:1px;">STORM WELLNESS CLUB</h1>
  </div>

  <!-- Content -->
  <div style="padding:30px 25px;">
    <h2 style="font-size:20px;color:#312D28;margin:0 0 20px;">Dear ${name},</h2>
    
    <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;">
      We encountered an issue processing your payment for ${amount}.
    </p>
    
    <div style="background:#fee2e2;border:1px solid #ef4444;border-radius:8px;padding:20px;margin:25px 0;">
      <p style="margin:0 0 10px 0;font-weight:600;color:#991b1b;">
        Payment Failed: ${failureReason}
      </p>
    </div>
    
    <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;">
      To ensure uninterrupted access to your membership, please update your payment method as soon as possible.
    </p>
    
    <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:20px;margin:25px 0;">
      <p style="margin:0;font-weight:600;color:#92400e;">
        ⏰ We will automatically retry your payment on ${nextRetry}. Please update your payment method before then to avoid service interruption.
      </p>
    </div>
    
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:25px 0;">
      <h3 style="margin:0 0 15px 0;color:#312D28;">What you need to do:</h3>
      <ul style="color:#374151;line-height:2;margin:0;padding-left:20px;">
        <li>Sign in to your member portal</li>
        <li>Go to Membership → Payment Methods</li>
        <li>Update your payment method or add a new card</li>
      </ul>
    </div>
    
    <div style="text-align:center;margin:30px 0;">
      <a href="#" style="display:inline-block;background:#312D28;color:#E8DED1;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;">Update Payment Method</a>
    </div>
    
    <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;">
      Common reasons for payment failure include:
    </p>
    <ul style="color:#374151;line-height:2;margin:0 0 20px 0;padding-left:20px;">
      <li>Insufficient funds</li>
      <li>Expired card</li>
      <li>Card number changed</li>
      <li>Bank declined the transaction</li>
    </ul>
    
    <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;">
      If you have any questions or need assistance, please don't hesitate to reach out to us.
    </p>
    
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <p style="font-style:italic;color:#6b7280;margin-bottom:5px;">Best regards,</p>
      <p style="font-weight:600;color:#1f2937;margin:0;">Storm Wellness Club Team</p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:20px 25px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">Storm Wellness Club · 123 Main St · Detroit, MI</p>
  </div>
</div>
</body>
</html>`;
}
