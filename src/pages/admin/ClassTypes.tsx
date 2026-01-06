import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Flame, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClassType {
  id: string;
  name: string;
  description: string | null;
  category: "reformer" | "cycling" | "aerobics";
  duration_minutes: number;
  max_capacity: number;
  is_heated: boolean;
  is_active: boolean;
}

export default function ClassTypes() {
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ClassType | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"reformer" | "cycling" | "aerobics">("aerobics");
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [maxCapacity, setMaxCapacity] = useState(20);
  const [isHeated, setIsHeated] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchClassTypes();
  }, []);

  async function fetchClassTypes() {
    const { data, error } = await supabase
      .from("class_types")
      .select("*")
      .order("name");
    
    if (error) {
      toast.error("Failed to load class types");
      console.error(error);
    } else {
      setClassTypes(data || []);
    }
    setLoading(false);
  }

  function resetForm() {
    setName("");
    setDescription("");
    setCategory("aerobics");
    setDurationMinutes(50);
    setMaxCapacity(20);
    setIsHeated(false);
    setIsActive(true);
    setEditingType(null);
  }

  function openEditDialog(classType: ClassType) {
    setEditingType(classType);
    setName(classType.name);
    setDescription(classType.description || "");
    setCategory(classType.category);
    setDurationMinutes(classType.duration_minutes);
    setMaxCapacity(classType.max_capacity);
    setIsHeated(classType.is_heated);
    setIsActive(classType.is_active);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    const classTypeData = {
      name: name.trim(),
      description: description.trim() || null,
      category,
      duration_minutes: durationMinutes,
      max_capacity: maxCapacity,
      is_heated: isHeated,
      is_active: isActive,
    };

    if (editingType) {
      const { error } = await supabase
        .from("class_types")
        .update(classTypeData)
        .eq("id", editingType.id);
      
      if (error) {
        toast.error("Failed to update class type");
        console.error(error);
      } else {
        toast.success("Class type updated");
        setDialogOpen(false);
        resetForm();
        fetchClassTypes();
      }
    } else {
      const { error } = await supabase
        .from("class_types")
        .insert([classTypeData]);
      
      if (error) {
        toast.error("Failed to create class type");
        console.error(error);
      } else {
        toast.success("Class type created");
        setDialogOpen(false);
        resetForm();
        fetchClassTypes();
      }
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Class Types</h1>
            <p className="text-muted-foreground">
              Manage the types of classes offered at the club
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Class Type
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingType ? "Edit Class Type" : "Add Class Type"}</DialogTitle>
                <DialogDescription>
                  {editingType ? "Update the class type details." : "Create a new type of class."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Reformer Sculpt"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the class"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as "reformer" | "cycling" | "aerobics")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reformer">Reformer Studio</SelectItem>
                        <SelectItem value="cycling">Cycling Studio</SelectItem>
                        <SelectItem value="aerobics">Aerobics Studio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Duration (min)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 50)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="capacity">Max Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 20)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="heated">Heated Class</Label>
                  <Switch
                    id="heated"
                    checked={isHeated}
                    onCheckedChange={setIsHeated}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Active</Label>
                  <Switch
                    id="active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editingType ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Class Types</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : classTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No class types found. Add your first class type to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Heated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classTypes.map((classType) => (
                    <TableRow key={classType.id}>
                      <TableCell className="font-medium">{classType.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {classType.category === "reformer" ? "Reformer Studio" : 
                           classType.category === "cycling" ? "Cycling Studio" : "Aerobics Studio"}
                        </Badge>
                      </TableCell>
                      <TableCell>{classType.duration_minutes} min</TableCell>
                      <TableCell>{classType.max_capacity}</TableCell>
                      <TableCell>
                        {classType.is_heated ? (
                          <Flame className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Snowflake className="h-4 w-4 text-blue-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={classType.is_active ? "default" : "secondary"}>
                          {classType.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(classType)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
