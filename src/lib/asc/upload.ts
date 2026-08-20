import { createHash } from "node:crypto";
import { ascRequest } from "./client";

interface UploadOperation {
  method: string;
  url: string;
  length: number;
  offset: number;
  requestHeaders: Array<{ name: string; value: string }>;
}

interface ReservationResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      fileSize: number;
      fileName: string;
      uploadOperations: UploadOperation[];
    };
  };
}

async function performUpload(operations: UploadOperation[], file: Buffer): Promise<void> {
  for (const op of operations) {
    const chunk = file.subarray(op.offset, op.offset + op.length);
    const headers: Record<string, string> = {};
    for (const h of op.requestHeaders) headers[h.name] = h.value;
    const res = await fetch(op.url, {
      method: op.method,
      headers,
      body: new Uint8Array(chunk),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Upload chunk failed (${res.status}): ${txt.slice(0, 200)}`);
    }
  }
}

function md5OfBuffer(buf: Buffer): string {
  return createHash("md5").update(buf).digest("hex");
}

export interface ScreenshotUploadInput {
  accountId: string;
  screenshotSetId: string;
  fileName: string;
  fileBuffer: Buffer;
}

export async function uploadAppScreenshot(input: ScreenshotUploadInput): Promise<{ id: string }> {
  const { accountId, screenshotSetId, fileName, fileBuffer } = input;

  const reservation = (await ascRequest(accountId, {
    method: "POST",
    path: "/v1/appScreenshots",
    body: {
      data: {
        type: "appScreenshots",
        attributes: {
          fileSize: fileBuffer.length,
          fileName,
        },
        relationships: {
          appScreenshotSet: {
            data: { id: screenshotSetId, type: "appScreenshotSets" },
          },
        },
      },
    },
  })) as ReservationResponse;

  const screenshotId = reservation.data.id;
  const operations = reservation.data.attributes.uploadOperations;

  await performUpload(operations, fileBuffer);

  await ascRequest(accountId, {
    method: "PATCH",
    path: `/v1/appScreenshots/${screenshotId}`,
    body: {
      data: {
        id: screenshotId,
        type: "appScreenshots",
        attributes: {
          uploaded: true,
          sourceFileChecksum: md5OfBuffer(fileBuffer),
        },
      },
    },
  });

  return { id: screenshotId };
}

export interface PreviewUploadInput {
  accountId: string;
  previewSetId: string;
  fileName: string;
  fileBuffer: Buffer;
}

export async function uploadAppPreview(input: PreviewUploadInput): Promise<{ id: string }> {
  const { accountId, previewSetId, fileName, fileBuffer } = input;

  const reservation = (await ascRequest(accountId, {
    method: "POST",
    path: "/v1/appPreviews",
    body: {
      data: {
        type: "appPreviews",
        attributes: { fileSize: fileBuffer.length, fileName },
        relationships: {
          appPreviewSet: { data: { id: previewSetId, type: "appPreviewSets" } },
        },
      },
    },
  })) as ReservationResponse;

  const previewId = reservation.data.id;
  await performUpload(reservation.data.attributes.uploadOperations, fileBuffer);

  await ascRequest(accountId, {
    method: "PATCH",
    path: `/v1/appPreviews/${previewId}`,
    body: {
      data: {
        id: previewId,
        type: "appPreviews",
        attributes: { uploaded: true, sourceFileChecksum: md5OfBuffer(fileBuffer) },
      },
    },
  });

  return { id: previewId };
}
