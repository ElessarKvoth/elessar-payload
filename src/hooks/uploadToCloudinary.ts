import type { CollectionBeforeChangeHook } from 'payload'
import cloudinary from '../lib/cloudinary'

export const uploadToCloudinary: CollectionBeforeChangeHook = async ({ req, data }) => {
  const file = req.file

  if (!file) return data

  // tempFilePath only exists with useTempFiles (Express).
  // In Next.js App Router / Vercel, file.data is always a populated Buffer.
  const dataUri = `data:${file.mimetype};base64,${file.data.toString('base64')}`

  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder: 'elessar-records',
    resource_type: 'image',
  })

  return {
    ...data,
    cloudinaryURL: uploaded.secure_url,
  }
}
