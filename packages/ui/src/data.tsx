import { type ReactNode } from "react";
import { tokens } from "./tokens";
import { EmptyState } from "./surfaces";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
}

export interface TableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  emptyTitle?: string;
}

/** Generic, reusable data table. Desktop-first; wrap in an overflow container. */
export function Table<T>({ columns, rows, getRowKey, emptyTitle = "Nothing here yet" }: TableProps<T>): JSX.Element {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} />;
  }
  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: tokens.font.size.md }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: col.align ?? "left",
                  width: col.width,
                  padding: `${tokens.space.sm} ${tokens.space.md}`,
                  borderBottom: `1px solid ${tokens.color.border}`,
                  color: tokens.color.textMuted,
                  fontWeight: tokens.font.weight.semibold,
                  fontSize: tokens.font.size.sm,
                  whiteSpace: "nowrap",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    textAlign: col.align ?? "left",
                    padding: `${tokens.space.sm} ${tokens.space.md}`,
                    borderBottom: `1px solid ${tokens.color.border}`,
                    color: tokens.color.text,
                  }}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
