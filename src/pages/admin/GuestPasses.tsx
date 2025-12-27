import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, Search, Plus, Clock, DollarSign } from "lucide-react";
import { useState } from "react";

const passTypes = [
  { id: 'day', name: 'Day Pass', price: 35, duration: '1 day' },
  { id: 'week', name: 'Week Pass', price: 150, duration: '7 days' },
  { id: 'guest', name: 'Member Guest Pass', price: 25, duration: '1 visit' },
];

export default function GuestPasses() {
  const [selectedPassType, setSelectedPassType] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [sponsoringMember, setSponsoringMember] = useState('');

  const selectedPass = passTypes.find(p => p.id === selectedPassType);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Guest Passes</h1>
          <p className="text-muted-foreground">
            Sell day passes and guest passes to visitors
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Sell New Pass */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Sell Guest Pass
              </CardTitle>
              <CardDescription>
                Create a new guest pass for a visitor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Pass Type</Label>
                <Select value={selectedPassType} onValueChange={setSelectedPassType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select pass type" />
                  </SelectTrigger>
                  <SelectContent>
                    {passTypes.map((pass) => (
                      <SelectItem key={pass.id} value={pass.id}>
                        {pass.name} - ${pass.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPass && (
                <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">${selectedPass.price}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedPass.duration}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="guestName">Guest Name</Label>
                <Input
                  id="guestName"
                  placeholder="Enter guest's full name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guestEmail">Guest Email</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  placeholder="Enter guest's email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>

              {selectedPassType === 'guest' && (
                <div className="space-y-2">
                  <Label htmlFor="sponsoringMember">Sponsoring Member</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="sponsoringMember"
                      className="pl-9"
                      placeholder="Search member by name or email"
                      value={sponsoringMember}
                      onChange={(e) => setSponsoringMember(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <Button className="w-full" disabled={!selectedPassType || !guestName}>
                <Plus className="h-4 w-4 mr-2" />
                Create Pass & Process Payment
              </Button>
            </CardContent>
          </Card>

          {/* Recent Passes */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Passes</CardTitle>
              <CardDescription>
                Guest passes sold today
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Ticket className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No passes sold today</p>
                <p className="text-sm">Passes will appear here once created</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
