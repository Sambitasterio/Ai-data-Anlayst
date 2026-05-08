export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

export type DatasetColumn = {
  name: string;
  dtype: string;
};

export type DatasetInfo = {
  id: string;
  file_name: string;
  stored_file_name: string;
  view_name: string;
  columns: DatasetColumn[];
};

export type DatasetPreview = {
  dataset_id: string;
  rows: Record<string, unknown>[];
};

export async function listDatasets(): Promise<DatasetInfo[]> {
  const response = await fetch(`${BACKEND_URL}/datasets`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to fetch datasets.");
  }
  return (await response.json()) as DatasetInfo[];
}

export async function getDatasetPreview(datasetId: string): Promise<DatasetPreview> {
  const response = await fetch(`${BACKEND_URL}/datasets/${datasetId}/preview`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch dataset preview.");
  }
  return (await response.json()) as DatasetPreview;
}

export async function uploadDataset(file: File): Promise<DatasetInfo> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Upload failed.");
  }

  return (await response.json()) as DatasetInfo;
}
