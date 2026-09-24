import React from 'react'
import { Cloudinary } from '@cloudinary/url-gen'
import { auto } from '@cloudinary/url-gen/actions/resize'
import { autoGravity } from '@cloudinary/url-gen/qualifiers/gravity'
import { AdvancedImage } from '@cloudinary/react'

export interface CloudinaryImageProps {
  publicId?: string
  width?: number
  height?: number
  className?: string
  alt?: string
}

export const CloudinaryImage: React.FC<CloudinaryImageProps> = ({
  publicId = 'cld-sample-5',
  width = 500,
  height = 500,
  className,
  alt = '',
}) => {
  const cld = new Cloudinary({ cloud: { cloudName: 'hqx8iva6' } })

  // Use this sample image or upload your own via the Media Library
  const img = cld
    .image(publicId)
    .format('auto') // Optimize delivery by resizing and applying auto-format and auto-quality
    .quality('auto')
    .resize(auto().gravity(autoGravity()).width(width).height(height)) // Transform the image: auto-crop to square aspect_ratio

  return <AdvancedImage cldImg={img} className={className} alt={alt} />
}

export default CloudinaryImage
