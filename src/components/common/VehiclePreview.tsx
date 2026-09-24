import React, { useState, Suspense, Component, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { VehicleSilhouette } from './vehicle-preview/VehicleSilhouette'

const VehicleScene = React.lazy(() => import('./vehicle-preview/VehicleScene'))

export interface VehiclePreviewProps {
  vehicleType: 'bike' | 'car' | 'ev' | 'bus' | 'other' | string
  color?: string | null
  make?: string | null
  plate?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

interface ErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
  onError?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
}

class SceneErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch() {
    if (this.props.onError) {
      this.props.onError()
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export const VehiclePreview: React.FC<VehiclePreviewProps> = ({
  vehicleType,
  color,
  make,
  plate,
  size,
  className,
}) => {
  const { t } = useTranslation('common')
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const [sceneFailed, setSceneFailed] = useState(false)

  const colorStr = color ? color.charAt(0).toUpperCase() + color.slice(1) : ''
  const makeStr = make || ''
  const typeStr = vehicleType || ''
  const plateStr = plate || ''

  const defaultAria = `${[colorStr, makeStr, typeStr].filter(Boolean).join(' ')}, ${plateStr}`.trim()
  const ariaLabel = t('vehicle.previewAriaLabel', {
    color: colorStr,
    make: makeStr,
    type: typeStr,
    plate: plateStr,
    defaultValue: defaultAria,
  })

  return (
    <div
      data-vaul-no-drag
      tabIndex={0}
      role="img"
      aria-label={ariaLabel}
      style={{ touchAction: 'pan-y' }}
      className={cn(
        'relative w-full overflow-hidden rounded-lg bg-surface-2 select-none outline-none focus-visible:ring-2 focus-visible:ring-focus',
        size === 'sm' ? 'h-[140px]' : size === 'lg' ? 'h-[240px]' : 'h-[176px] md:h-[220px]',
        className
      )}
    >
      {/* Poster / Fallback Silhouette */}
      {(!sceneLoaded || sceneFailed) && (
        <VehicleSilhouette vehicleType={vehicleType} color={color} />
      )}

      {/* 3D WebGL Scene */}
      {!sceneFailed && (
        <SceneErrorBoundary fallback={null} onError={() => setSceneFailed(true)}>
          <Suspense fallback={null}>
            <VehicleScene
              vehicleType={vehicleType}
              color={color}
              make={make}
              plate={plate}
              onLoaded={() => setSceneLoaded(true)}
            />
          </Suspense>
        </SceneErrorBoundary>
      )}
    </div>
  )
}

export default VehiclePreview
