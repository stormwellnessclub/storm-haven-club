import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstructorContext } from "@/hooks/useInstructorContext";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, ShieldCheck, Eye, X } from "lucide-react";

interface Row {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export function InstructorModeSwitcher() {
  const { isAdmin, ownInstructor, instructor, isImpersonating, setViewAs, clearViewAs } = useInstructorContext();
  const [instructors, setInstructors] = useState<Row[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("instructors")
        .select("id,first_name,last_name,is_active")
        .eq("is_active", true)
        .order("first_name");
      setInstructors((data as Row[]) ?? []);
    })();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const currentLabel = isImpersonating && instructor
    ? `Viewing as ${instructor.first_name} ${instructor.last_name}`
    : ownInstructor
      ? `My view (${ownInstructor.first_name} ${ownInstructor.last_name})`
      : "Instructor mode";

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-[#C5A059]/40 bg-white text-xs uppercase tracking-widest text-[#1A1A1A] hover:bg-[#F5F2ED]"
          >
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-[#C5A059]" />
            {currentLabel}
            <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-96 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-gray-500">
            Instructor mode
          </DropdownMenuLabel>
          {ownInstructor && (
            <DropdownMenuItem onClick={() => clearViewAs()}>
              <Eye className="mr-2 h-4 w-4" />
              My view ({ownInstructor.first_name} {ownInstructor.last_name})
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-gray-500">
            View as instructor
          </DropdownMenuLabel>
          {instructors
            .filter((i) => !ownInstructor || i.id !== ownInstructor.id)
            .map((i) => (
              <DropdownMenuItem key={i.id} onClick={() => setViewAs(i.id)}>
                {i.first_name} {i.last_name}
              </DropdownMenuItem>
            ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/admin/instructors")}>
            <ShieldCheck className="mr-2 h-4 w-4 text-[#C5A059]" />
            Admin mode → Instructors
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isImpersonating && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-gray-600 hover:text-[#1A1A1A]"
          onClick={clearViewAs}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Exit view-as
        </Button>
      )}
    </div>
  );
}
