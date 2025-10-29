import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmailColorPicker, EmailCellColor } from "./EmailColorPicker";
import { Plus, Trash2 } from "lucide-react";

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
  const [selectedCells, setSelectedCells] = useState<Array<{ rowIndex: number; cellIndex: number }>>([]);

  const handleCellClick = (rowIndex: number, cellIndex: number, event: React.MouseEvent) => {
    if (event.shiftKey && selectedCells.length > 0) {
      // Shift+Click: Select range
      const lastSelected = selectedCells[selectedCells.length - 1];
      const newSelections: Array<{ rowIndex: number; cellIndex: number }> = [];
      
      const minRow = Math.min(lastSelected.rowIndex, rowIndex);
      const maxRow = Math.max(lastSelected.rowIndex, rowIndex);
      const minCol = Math.min(lastSelected.cellIndex, cellIndex);
      const maxCol = Math.max(lastSelected.cellIndex, cellIndex);
      
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          newSelections.push({ rowIndex: r, cellIndex: c });
        }
      }
      setSelectedCells(newSelections);
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: Add to selection
      const exists = selectedCells.some(
        cell => cell.rowIndex === rowIndex && cell.cellIndex === cellIndex
      );
      if (exists) {
        setSelectedCells(selectedCells.filter(
          cell => !(cell.rowIndex === rowIndex && cell.cellIndex === cellIndex)
        ));
      } else {
        setSelectedCells([...selectedCells, { rowIndex, cellIndex }]);
      }
    } else {
      // Normal click: Single selection
      setSelectedCells([{ rowIndex, cellIndex }]);
    }
  };

  const bulkUpdateColor = (color: EmailCellColor) => {
    const newRows = [...table.rows];
    selectedCells.forEach(({ rowIndex, cellIndex }) => {
      if (newRows[rowIndex]?.cells[cellIndex]) {
        newRows[rowIndex].cells[cellIndex].backgroundColor = color;
      }
    });
    onChange({ ...table, rows: newRows });
  };

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
                  <div className="flex flex-col gap-0.5">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 w-5 p-0 hover:bg-primary/10"
                      onClick={() => addRow('below', rowIndex)}
                      title="Add row below"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    {table.rows.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 w-5 p-0 hover:bg-destructive/10 text-destructive"
                        onClick={() => deleteRow(rowIndex)}
                        title="Delete row"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </td>
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={cell.id}
                    className={`border p-0 ${getColorClass(cell.backgroundColor)} ${
                      selectedCells.some(s => s.rowIndex === rowIndex && s.cellIndex === cellIndex)
                        ? 'ring-2 ring-primary'
                        : ''
                    }`}
                    onClick={(e) => handleCellClick(rowIndex, cellIndex, e)}
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
                  <div className="flex gap-1 justify-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 w-5 p-0 hover:bg-primary/10"
                      onClick={() => addColumn('right', cellIndex)}
                      title="Add column to the right"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    {table.rows[0]?.cells.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 w-5 p-0 hover:bg-destructive/10 text-destructive"
                        onClick={() => deleteColumn(cellIndex)}
                        title="Delete column"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {selectedCells.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
          <span className="text-sm font-medium">
            {selectedCells.length > 1 
              ? `${selectedCells.length} cells selected` 
              : 'Cell Color:'}
          </span>
          <EmailColorPicker
            value={selectedCells.length === 1 
              ? table.rows[selectedCells[0].rowIndex]?.cells[selectedCells[0].cellIndex]?.backgroundColor || 'white'
              : 'white'}
            onChange={bulkUpdateColor}
          />
          {selectedCells.length > 1 && (
            <span className="text-xs text-muted-foreground ml-2">
              💡 Shift+Click to select range, Ctrl+Click to multi-select
            </span>
          )}
        </div>
      )}
    </div>
  );
}
