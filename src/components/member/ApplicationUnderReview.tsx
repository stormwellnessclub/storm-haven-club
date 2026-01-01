import { Clock, CheckCircle, Mail, Phone, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import logo from "@/assets/storm-logo-gold.png";

interface ApplicationUnderReviewProps {
  applicationData: {
    full_name: string;
    membership_plan: string;
    created_at: string;
    status: string;
  };
}

export function ApplicationUnderReview({ applicationData }: ApplicationUnderReviewProps) {
  const submittedDate = format(parseISO(applicationData.created_at), "MMMM d, yyyy");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Storm Wellness Club" className="h-12 w-auto" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Website
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 mb-6">
            <Clock className="w-10 h-10 text-accent" />
          </div>
          <h1 className="heading-section mb-3">Application Under Review</h1>
          <p className="text-muted-foreground text-lg">
            Thank you for your interest in joining Storm Wellness Club, {applicationData.full_name.split(" ")[0]}!
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Application Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-border">
              <span className="text-muted-foreground">Membership Plan</span>
              <span className="font-medium">{applicationData.membership_plan}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border">
              <span className="text-muted-foreground">Submitted On</span>
              <span className="font-medium">{submittedDate}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-muted-foreground">Status</span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-sm font-medium">
                <Clock className="w-4 h-4" />
                Under Review
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 bg-muted/30">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">What Happens Next?</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold text-sm">
                  1
                </div>
                <div>
                  <p className="font-medium">Application Review</p>
                  <p className="text-muted-foreground text-sm">
                    Our membership team reviews all applications within 2-3 business days.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold text-sm">
                  2
                </div>
                <div>
                  <p className="font-medium">Email Notification</p>
                  <p className="text-muted-foreground text-sm">
                    You'll receive an email once your application has been reviewed.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold text-sm">
                  3
                </div>
                <div>
                  <p className="font-medium">Welcome to Storm</p>
                  <p className="text-muted-foreground text-sm">
                    Upon approval, your member portal will be fully activated.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Questions?</h3>
            <p className="text-muted-foreground text-sm mb-4">
              If you have any questions about your application or membership, please don't hesitate to reach out.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="mailto:membership@stormwellnessclub.com" 
                className="flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <Mail className="w-4 h-4" />
                membership@stormwellnessclub.com
              </a>
              <a 
                href="tel:+17135551234" 
                className="flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <Phone className="w-4 h-4" />
                (713) 555-1234
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Link to="/">
            <Button variant="outline">
              Explore Our Website
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
