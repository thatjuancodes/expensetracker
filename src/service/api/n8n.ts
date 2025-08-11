import { env } from '../../config/env'

export interface N8nUploadSuccessResponse<T = unknown> {
  success: boolean
  message?: string
  // Shape depends on your n8n workflow. Keep generic and allow callers to refine with T.
  agent_output?: T
  [key: string]: unknown
}

export interface UploadReceiptOptions {
  signal?: AbortSignal
  fieldName?: string
  filename?: string
}

function createFormDataFromFile(
  file: File | Blob,
  fieldName: string,
  filename?: string,
): FormData {
  const formData = new FormData()
  // For Blob without name, browsers require a filename argument
  if (file instanceof File) {
    formData.append(fieldName, file, filename ?? file.name)
  } else {
    formData.append(fieldName, file, filename ?? 'upload.jpg')
  }
  return formData
}

export class N8nClient {
  private readonly uploadUrl: string

  constructor(uploadUrl?: string) {
    this.uploadUrl = uploadUrl ?? env.n8nUploadUrl
  }

  async uploadReceipt<T = unknown>(
    file: File | Blob,
    options: UploadReceiptOptions = {},
  ): Promise<N8nUploadSuccessResponse<T>> {
    const { signal, fieldName = 'file', filename } = options

    if (!(file instanceof Blob)) {
      throw new Error('uploadReceipt: invalid file provided')
    }

    const formData = createFormDataFromFile(file, fieldName, filename)

    if (!this.uploadUrl) {
      throw new Error(
        'Missing n8n upload URL. Set VITE_N8N_UPLOAD_URL or pass a URL to new N8nClient(url).',
      )
    }

    const response = await fetch(this.uploadUrl, {
      method: 'POST',
      body: formData,
      // Do not set Content-Type for multipart; the browser will set the correct boundary
      signal,
    })

    const contentType = response.headers.get('content-type') ?? ''
    const isJson = contentType.includes('application/json')
    const payload = isJson ? await response.json().catch(() => null) : await response.text()

    if (!response.ok) {
      const errorMessage = isJson
        ? (payload as Record<string, unknown>)?.message || JSON.stringify(payload)
        : (payload as string)
      throw new Error(
        `Upload failed (${response.status} ${response.statusText})${
          errorMessage ? `: ${String(errorMessage)}` : ''
        }`,
      )
    }

    return (payload as N8nUploadSuccessResponse<T>) ?? { success: true }
  }
}

export const n8nClient = new N8nClient()

