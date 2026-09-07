import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import sharp from 'sharp'
import cloudinary from '../lib/cloudinary'

// Formato do recorte enviado pelo admin do Payload em `?uploadEdits=`.
// `crop.x` / `crop.y` são PERCENTUAIS; largura/altura vêm em PIXELS.
interface UploadEdits {
  crop?: { x?: number; y?: number }
  widthInPixels?: number | string
  heightInPixels?: number | string
}

function lerUploadEdits(req: PayloadRequest): UploadEdits | null {
  const q = req.query as Record<string, unknown> | undefined
  const edits = q?.uploadEdits
  if (edits && typeof edits === 'object') return edits as UploadEdits
  return null
}

/**
 * Aplica o recorte feito no admin e envia a imagem ao Cloudinary.
 *
 * POR QUE O RECORTE PRECISA SER REFEITO AQUI:
 * o Payload corta a imagem em `generateFileData`, mas guarda o resultado em
 * `filesToUpload` — que só é consumido depois, em `uploadFiles`. Este hook roda
 * ANTES disso (ordem em collections/operations/create.js: generateFileData →
 * beforeChange → uploadFiles) e enxerga apenas `req.file.data`, o buffer
 * ORIGINAL. Sem reaplicar o corte, o Cloudinary receberia a imagem inteira e o
 * recorte do usuário seria descartado silenciosamente.
 *
 * A conversão percentual → pixel é a mesma de uploads/cropImage.js do Payload.
 */
export const uploadToCloudinary: CollectionBeforeChangeHook = async ({ req, data }) => {
  const file = req.file
  if (!file) return data

  let buffer = file.data

  const edits = lerUploadEdits(req)
  const largura = Number(edits?.widthInPixels)
  const altura = Number(edits?.heightInPixels)

  if (edits?.crop && Number.isFinite(largura) && Number.isFinite(altura) && largura > 0 && altura > 0) {
    try {
      const meta = await sharp(buffer).metadata()
      if (meta.width && meta.height) {
        const x = Number(edits.crop.x) || 0
        const y = Number(edits.crop.y) || 0
        const left = Math.max(0, Math.min(Math.floor((x / 100) * meta.width), meta.width - 1))
        const top = Math.max(0, Math.min(Math.floor((y / 100) * meta.height), meta.height - 1))
        // Nunca extrair além da borda — sharp lança erro se a área ultrapassar.
        const width = Math.min(Math.round(largura), meta.width - left)
        const height = Math.min(Math.round(altura), meta.height - top)

        if (width > 0 && height > 0) {
          buffer = await sharp(buffer).extract({ left, top, width, height }).toBuffer()
        }
      }
    } catch (err) {
      // Recorte é um refinamento: se falhar, sobe a imagem inteira em vez de
      // barrar o cadastro. O motivo fica no log para investigação.
      req.payload.logger.error(`[media] Falha ao aplicar recorte: ${(err as Error).message}`)
    }
  }

  const dataUri = `data:${file.mimetype};base64,${buffer.toString('base64')}`

  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder: 'elessar-records',
    resource_type: 'image',
  })

  return {
    ...data,
    cloudinaryURL: uploaded.secure_url,
  }
}
