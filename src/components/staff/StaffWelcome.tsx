import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight } from "lucide-react";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, getDefaultAdminPage, type AppRole } from "@/lib/permissions";
import logo from "@/assets/storm-logo.png";

interface StaffWelcomeProps {
  roles: AppRole[];
  onContinue: () => void;
}

export function StaffWelcome({ roles, onContinue }: StaffWelcomeProps) {
  const navigate = useNavigate();
  const targetPage = getDefaultAdminPage(roles);

  const handleGoToDashboard = () => {
    onContinue();
    navigate(targetPage);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-lg text-center">
        <img src={logo} alt="Storm Wellness Club" className="h-16 mx-auto mb-6" />

        <div className="mb-6 p-4 rounded-lg bg-accent/10 border border-accent/30 inline-flex items-center gap-3">
          <Shield className="h-6 w-6 text-accent flex-shrink-0" />
          <span className="font-semibold text-lg">Welcome to the Team!</span>
        </div>

        <p className="text-muted-foreground mb-8">
          Your staff account is set up and ready to go. Here's what you've been assigned:
        </p>

        <div className="space-y-3 mb-8 text-left">
          {roles.map((role) => (
            <div
              key={role}
              className="p-4 rounded-lg border border-border bg-card"
            >
              <p className="font-semibold text-sm">{ROLE_LABELS[role]}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          ))}
        </div>

        <Button onClick={handleGoToDashboard} size="lg" className="w-full">
          Go to Your Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
