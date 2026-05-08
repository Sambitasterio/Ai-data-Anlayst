"use client";

import { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  getDatasetPreview,
  uploadDataset,
  type DatasetInfo,
  type DatasetPreview,
} from "@/lib/api";

type DropzoneProps = {
  onUploaded: (dataset: DatasetInfo, preview: DatasetPreview) => void;
};

type PreviewRow = Record<string, unknown>;

export function DatasetDropzone({ onUploaded }: DropzoneProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) {
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const dataset = await uploadDataset(file);
      const previewRows = await getDatasetPreview(dataset.id);
      setPreview(previewRows);
      onUploaded(dataset, previewRows);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
  });

  const previewRows = preview?.rows ?? [];
  const previewColumns = useMemo(() => {
    const firstRow = previewRows[0];
    if (!firstRow) {
      return [];
    }

    const helper = createColumnHelper<PreviewRow>();
    return Object.keys(firstRow).map((key) =>
      helper.accessor((row) => row[key], {
        id: key,
        header: key,
        cell: (info) => String(info.getValue() ?? ""),
      })
    );
  }, [previewRows]);

  const table = useReactTable({
    data: previewRows,
    columns: previewColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className="rounded-lg border border-dashed p-4 text-sm transition-colors hover:border-primary/60"
      >
        <input {...getInputProps()} />
        <p className="text-muted-foreground">
          {isDragActive
            ? "Drop the file to upload"
            : "Drag and drop CSV/XLSX here, or click to browse"}
        </p>
      </div>

      {isUploading ? (
        <Button variant="outline" disabled>
          Uploading...
        </Button>
      ) : null}

      {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}

      {previewRows.length > 0 ? (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-2 py-2 text-left font-medium">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-2 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
