import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Baby, Search, UserCheck, UserX, Clock, Users } from "lucide-react";
import { useState } from "react";

interface Child {
  id: string;
  name: string;
  age: number;
  parentName: string;
  checkedIn: boolean;
  checkInTime?: string;
}

const mockChildren: Child[] = [
  { id: '1', name: 'Emma Johnson', age: 4, parentName: 'Sarah Johnson', checkedIn: true, checkInTime: '9:30 AM' },
  { id: '2', name: 'Liam Smith', age: 3, parentName: 'Mike Smith', checkedIn: true, checkInTime: '10:00 AM' },
  { id: '3', name: 'Olivia Brown', age: 5, parentName: 'Jennifer Brown', checkedIn: false },
];

export default function Childcare() {
  const [searchQuery, setSearchQuery] = useState('');
  const [children, setChildren] = useState<Child[]>(mockChildren);

  const checkedInCount = children.filter(c => c.checkedIn).length;

  const toggleCheckIn = (childId: string) => {
    setChildren(prev => prev.map(child => {
      if (child.id === childId) {
        return {
          ...child,
          checkedIn: !child.checkedIn,
          checkInTime: !child.checkedIn ? new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : undefined,
        };
      }
      return child;
    }));
  };

  const filteredChildren = children.filter(child =>
    child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    child.parentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Childcare</h1>
            <p className="text-muted-foreground">
              Manage children check-in and roster
            </p>
          </div>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-semibold">{checkedInCount}</span> children checked in
              </span>
            </div>
          </Card>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by child or parent name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredChildren.map((child) => (
            <Card key={child.id} className={child.checkedIn ? 'border-green-500/50' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Baby className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{child.name}</CardTitle>
                      <CardDescription>Age {child.age}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={child.checkedIn ? 'default' : 'secondary'}>
                    {child.checkedIn ? 'Checked In' : 'Not Here'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Parent: </span>
                  <span>{child.parentName}</span>
                </div>
                {child.checkedIn && child.checkInTime && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Checked in at {child.checkInTime}
                  </div>
                )}
                <Button
                  className="w-full"
                  variant={child.checkedIn ? 'outline' : 'default'}
                  onClick={() => toggleCheckIn(child.id)}
                >
                  {child.checkedIn ? (
                    <>
                      <UserX className="h-4 w-4 mr-2" />
                      Check Out
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Check In
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredChildren.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Baby className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No children found</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
