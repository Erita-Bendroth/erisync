import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmailColorPicker, EmailCellColor } from "./EmailColorPicker";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface EmailTableCell {
  id: string;
  content: string;
  backgroundColor: EmailCellColor;
  colSpan?: number;
}

export interface EmailTableRow {
  id: string;
  cells: EmailTableCell[];
}

export interface EmailRegionTable {
  id: string;
  title: string;
  rows: EmailTableRow[];
}

interface EmailTableBuilderProps {
  table: EmailRegionTable;
  onChange: (table: EmailRegionTable) => void;
  onDelete: () => void;
}

export function EmailTableBuilder({ table, onChange, onDelete }: EmailTableBuilderProps) {
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; cellIndex: number } | null>(null);

  const updateCell = (rowIndex: number, cellIndex: number, updates: Partial<EmailTableCell>) => {
    const newRows = [...table.rows];
    newRows[rowIndex].cells[cellIndex] = {
      ...newRows[rowIndex].cells[cellIndex],
      ...updates,
    };
    onChange({ ...table, rows: newRows });
  };

  const addRow = (position: 'above' | 'below', rowIndex: number) => {
    const newRows = [...table.rows];
    const numColumns = newRows[0]?.cells.length || 6;
    const newRow: EmailTableRow = {
      id: crypto.randomUUID(),
      cells: Array.from({ length: numColumns }, () => ({
        id: crypto.randomUUID(),
        content: '',
        backgroundColor: 'white' as EmailCellColor,
      })),
    };
    
    const insertIndex = position === 'above' ? rowIndex : rowIndex + 1;
    newRows.splice(insertIndex, 0, newRow);
    onChange({ ...table, rows: newRows });
  };

  const deleteRow = (rowIndex: number) => {
    if (table.rows.length <= 1) return; // Keep at least one row
    const newRows = table.rows.filter((_, i) => i !== rowIndex);
    onChange({ ...table, rows: newRows });
  };

  const addColumn = (position: 'left' | 'right', cellIndex: number) => {
    const newRows = table.rows.map(row => {
      const newCells = [...row.cells];
      const insertIndex = position === 'left' ? cellIndex : cellIndex + 1;
      newCells.splice(insertIndex, 0, {
        id: crypto.randomUUID(),
        content: '',
        backgroundColor: 'white' as EmailCellColor,
      });
      return { ...row, cells: newCells };
    });
    onChange({ ...table, rows: newRows });
  };

  const deleteColumn = (cellIndex: number) => {
    if (table.rows[0]?.cells.length <= 1) return; // Keep at least one column
    const newRows = table.rows.map(row => ({
      ...row,
      cells: row.cells.filter((_, i) => i !== cellIndex),
    }));
    onChange({ ...table, rows: newRows });
  };

  const getColorClass = (color: EmailCellColor) => {
    const colorMap: Record<EmailCellColor, string> = {
      white: 'bg-white',
      green: 'bg-green-200',
      yellow: 'bg-yellow-200',
      red: 'bg-red-200',
      orange: 'bg-orange-200',
    };
    return colorMap[color];
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between gap-2">
        <Input
          value={table.title}
          onChange={(e) => onChange({ ...table, title: e.target.value })}
          placeholder="Table title (e.g., Reg. East: Vertretungsplan KW 44)"
          className="flex-1"
        />
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="w-full border-collapse">
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={row.id}>
                <td className="p-1 bg-muted/50 border-r">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => addRow('above', rowIndex)}>
                        <Plus className="h-4 w-4 mr-2" /> Add Row Above
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addRow('below', rowIndex)}>
                        <Plus className="h-4 w-4 mr-2" /> Add Row Below
                      </DropdownMenuItem>
                      {table.rows.length > 1 && (
                        <DropdownMenuItem onClick={() => deleteRow(rowIndex)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete Row
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={cell.id}
                    className={`border p-0 ${getColorClass(cell.backgroundColor)} ${
                      selectedCell?.rowIndex === rowIndex && selectedCell?.cellIndex === cellIndex
                        ? 'ring-2 ring-primary'
                        : ''
                    }`}
                    onClick={() => setSelectedCell({ rowIndex, cellIndex })}
                  >
                    <Textarea
                      value={cell.content}
                      onChange={(e) => updateCell(rowIndex, cellIndex, { content: e.target.value })}
                      className="min-h-[60px] border-0 bg-transparent resize-none text-xs"
                      placeholder="Cell content"
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="p-1 bg-muted/50"></td>
              {table.rows[0]?.cells.map((_, cellIndex) => (
                <td key={cellIndex} className="p-1 bg-muted/50 border-t">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-full p-0">
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => addColumn('left', cellIndex)}>
                        <Plus className="h-4 w-4 mr-2" /> Add Column Left
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addColumn('right', cellIndex)}>
                        <Plus className="h-4 w-4 mr-2" /> Add Column Right
                      </DropdownMenuItem>
                      {table.rows[0]?.cells.length > 1 && (
                        <DropdownMenuItem onClick={() => deleteColumn(cellIndex)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete Column
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
          <span className="text-sm font-medium">Cell Color:</span>
          <EmailColorPicker
            value={table.rows[selectedCell.rowIndex]?.cells[selectedCell.cellIndex]?.backgroundColor || 'white'}
            onChange={(color) => updateCell(selectedCell.rowIndex, selectedCell.cellIndex, { backgroundColor: color })}
          />
        </div>
      )}
    </div>
  );
}
