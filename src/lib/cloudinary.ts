import { Cloudinary } from '@cloudinary/url-gen'
import { auto } from '@cloudinary/url-gen/actions/resize'
import { autoGravity } from '@cloudinary/url-gen/qualifiers/gravity'

export const CLOUDINARY_CLOUD_NAME = 'hqx8iva6'

export const cld = new Cloudinary({
  cloud: {
    cloudName: CLOUDINARY_CLOUD_NAME,
  },
})

/**
 * Creates an optimized Cloudinary image object with auto-format, auto-quality,
 * and auto-gravity square/custom resizing.
 */
export function getOptimizedCloudinaryImage(
  publicId = 'cld-sample-5',
  width = 500,
  height = 500,
) {
  return cld
    .image(publicId)
    .format('auto')
    .quality('auto')
    .resize(auto().gravity(autoGravity()).width(width).height(height))
}
