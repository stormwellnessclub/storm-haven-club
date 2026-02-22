import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Mail, Loader2, CheckCircle, Clock } from "lucide-react";

interface PendingPerson {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  passCategory: "pilates_cycling" | "aerobics" | "other";
  classesTotal: number;
}

const emptyPerson: PendingPerson = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  passCategory: "pilates_cycling",
  classesTotal: 10,
};

export function BulkNonMemberImport() {
  const queryClient = useQueryClient();
  const [people, setPeople] = useState<PendingPerson[]>([{ ...emptyPerson }]);

  // Fetch existing pending imports
  const { data: pendingImports, isLoading: loadingPending } = useQuery({
    queryKey: ["pending-non-member-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_non_member_imports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addPerson = () => setPeople((prev) => [...prev, { ...emptyPerson }]);

  const removePerson = (index: number) => {
    setPeople((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePerson = (index: number, field: keyof PendingPerson, value: string | number) => {
    setPeople((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  // Submit all pending imports
  const submitMutation = useMutation({
    mutationFn: async (entries: PendingPerson[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const rows = entries.map((p) => ({
        email: p.email.trim().toLowerCase(),
        first_name: p.firstName.trim(),
        last_name: p.lastName.trim(),
        phone: p.phone.trim(),
        pass_category: p.passCategory,
        pass_type: p.classesTotal === 1 ? "single" : "10-pack",
        classes_total: p.classesTotal,
        expiration_days: 90,
        status: "pending" as const,
        created_by: user.id,
      }));

      const { data, error } = await supabase
        .from("pending_non_member_imports")
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.length} pending import(s) created`);
      setPeople([{ ...emptyPerson }]);
      queryClient.invalidateQueries({ queryKey: ["pending-non-member-imports"] });
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  // Send activation email
  const sendEmailMutation = useMutation({
    mutationFn: async ({ email, firstName }: { email: string; firstName: string }) => {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { type: "account_activation_invite", to: email, data: { email, first_name: firstName } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success("Activation email sent"),
    onError: (err: Error) => toast.error(`Email failed: ${err.message}`),
  });

  const validPeople = people.filter(
    (p) => p.email.trim() && p.firstName.trim() && p.lastName.trim()
  );

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case "pilates_cycling": return "Pilates/Cycling";
      case "aerobics": return "Aerobics";
      default: return "Other";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" /> Bulk Pre-Register Non-Members
        </CardTitle>
        <CardDescription>
          Add people who purchased class passes but don't have accounts yet. When they sign up, their passes will be created automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Entry form */}
        <div className="space-y-3">
          {people.map((person, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end border-b pb-3 last:border-0">
              <Input
                placeholder="First name"
                value={person.firstName}
                onChange={(e) => updatePerson(i, "firstName", e.target.value)}
              />
              <Input
                placeholder="Last name"
                value={person.lastName}
                onChange={(e) => updatePerson(i, "lastName", e.target.value)}
              />
              <Input
                type="email"
                placeholder="Email"
                value={person.email}
                onChange={(e) => updatePerson(i, "email", e.target.value)}
              />
              <Input
                placeholder="Phone"
                value={person.phone}
                onChange={(e) => updatePerson(i, "phone", e.target.value)}
              />
              <Select
                value={person.passCategory}
                onValueChange={(v) => updatePerson(i, "passCategory", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pilates_cycling">Pilates/Cycling 10-pack</SelectItem>
                  <SelectItem value="aerobics">Aerobics 10-pack</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removePerson(i)}
                disabled={people.length === 1}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addPerson}>
              <Plus className="h-4 w-4 mr-1" /> Add Row
            </Button>
            <Button
              size="sm"
              onClick={() => submitMutation.mutate(validPeople)}
              disabled={validPeople.length === 0 || submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Submit {validPeople.length} Record{validPeople.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>

        {/* Pending imports list */}
        {(pendingImports?.length ?? 0) > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Pending Imports</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Pass</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingImports?.map((imp: any) => (
                  <TableRow key={imp.id}>
                    <TableCell className="font-medium">
                      {imp.first_name} {imp.last_name}
                    </TableCell>
                    <TableCell className="text-sm">{imp.email}</TableCell>
                    <TableCell className="text-sm">
                      {categoryLabel(imp.pass_category)} ({imp.classes_total})
                    </TableCell>
                    <TableCell>
                      {imp.status === "fulfilled" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" /> Fulfilled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <Clock className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {imp.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sendEmailMutation.mutate({ email: imp.email, firstName: imp.first_name })}
                          disabled={sendEmailMutation.isPending}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
