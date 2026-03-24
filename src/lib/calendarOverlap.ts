/**
 * Compute overlap columns for calendar blocks within a single day.
 * Returns a map of block ID → { columnIndex, totalColumns }.
 */

interface TimeBlock {
  id: string;
  startMinutes: number;
  endMinutes: number;
}

interface OverlapResult {
  columnIndex: number;
  totalColumns: number;
}

export function computeOverlapColumns(blocks: TimeBlock[]): Map<string, OverlapResult> {
  if (blocks.length === 0) return new Map();

  // Sort by start time, then by end time descending (longer events first)
  const sorted = [...blocks].sort((a, b) => 
    a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes
  );

  // Build overlap groups using a sweep approach
  const columnAssignment = new Map<string, number>();
  const groups: string[][] = [];

  // For each block, find which column it can go in
  const columns: { id: string; end: number }[][] = [];

  for (const block of sorted) {
    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      // Check if this column is free (last block in column ended before this starts)
      const lastInCol = columns[col][columns[col].length - 1];
      if (lastInCol.end <= block.startMinutes) {
        columns[col].push({ id: block.id, end: block.endMinutes });
        columnAssignment.set(block.id, col);
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ id: block.id, end: block.endMinutes }]);
      columnAssignment.set(block.id, columns.length - 1);
    }
  }

  // Now determine overlap groups - blocks that overlap need to know the max columns in their group
  // Build adjacency: two blocks overlap if their time ranges intersect
  const overlaps = (a: TimeBlock, b: TimeBlock) =>
    a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;

  // Union-Find for grouping
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (overlaps(sorted[i], sorted[j])) {
        union(sorted[i].id, sorted[j].id);
      }
    }
  }

  // Group blocks by their root
  const groupMap = new Map<string, string[]>();
  for (const block of sorted) {
    const root = find(block.id);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(block.id);
  }

  // For each group, determine the total columns used
  const result = new Map<string, OverlapResult>();
  for (const [, members] of groupMap) {
    const usedCols = new Set(members.map(id => columnAssignment.get(id)!));
    const totalColumns = usedCols.size;
    // Remap column indices to be contiguous 0..n-1
    const sortedCols = [...usedCols].sort((a, b) => a - b);
    const colRemap = new Map<number, number>();
    sortedCols.forEach((col, idx) => colRemap.set(col, idx));

    for (const id of members) {
      result.set(id, {
        columnIndex: colRemap.get(columnAssignment.get(id)!)!,
        totalColumns,
      });
    }
  }

  return result;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}
