import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface AdminWidgetBoundaryProps {
  children: ReactNode;
  title?: string;
  fallback?: ReactNode;
}

interface AdminWidgetBoundaryState {
  hasError: boolean;
}

export class AdminWidgetBoundary extends Component<AdminWidgetBoundaryProps, AdminWidgetBoundaryState> {
  state: AdminWidgetBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AdminWidgetBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Admin widget crashed:", this.props.title ?? "Unknown widget", error.message, errorInfo.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <Card className="border-border bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            {this.props.title ?? "Module unavailable"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground">
          This panel is temporarily unavailable.
        </CardContent>
      </Card>
    );
  }
}