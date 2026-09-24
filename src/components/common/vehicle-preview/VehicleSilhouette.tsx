import React from 'react'
import { paintFor } from './paint'

interface VehicleSilhouetteProps {
  vehicleType: string
  color?: string | null
  className?: string
}

export const VehicleSilhouette: React.FC<VehicleSilhouetteProps> = ({ vehicleType, color, className }) => {
  const tintColor = paintFor(color)
  const normType = (vehicleType || '').toLowerCase().trim()

  return (
    <div className={`w-full h-full flex items-center justify-center p-4 ${className || ''}`}>
      {normType === 'bike' && (
        <svg viewBox="0 0 200 120" className="w-full h-full max-h-[140px] drop-shadow-sm">
          {/* Motorcycle/Scooter SVG Silhouette */}
          <circle cx="45" cy="85" r="22" fill="#162033" />
          <circle cx="45" cy="85" r="12" fill="#EEF1F5" />
          <circle cx="155" cy="85" r="22" fill="#162033" />
          <circle cx="155" cy="85" r="12" fill="#EEF1F5" />
          {/* Main frame / body */}
          <path
            d="M 50 85 L 80 50 L 120 50 L 155 85 L 140 85 L 115 65 L 75 65 L 55 85 Z"
            fill={tintColor}
            stroke="#162033"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Tank & Seat */}
          <path d="M 80 50 C 90 35 110 35 125 45 C 140 45 150 55 145 62 L 75 62 Z" fill={tintColor} stroke="#162033" strokeWidth="3" />
          <path d="M 115 45 L 145 45 C 150 45 152 52 145 58 Z" fill="#162033" />
          {/* Handlebar & Headlight */}
          <path d="M 75 52 L 65 30 L 78 30" stroke="#162033" strokeWidth="4" strokeLinecap="round" fill="none" />
          <circle cx="62" cy="32" r="5" fill="#FFFDE7" stroke="#162033" strokeWidth="2" />
        </svg>
      )}

      {(normType === 'car' || normType === 'ev') && (
        <svg viewBox="0 0 240 120" className="w-full h-full max-h-[140px] drop-shadow-sm">
          {/* Car/EV Silhouette */}
          {/* Wheels */}
          <circle cx="55" cy="88" r="20" fill="#162033" />
          <circle cx="55" cy="88" r="10" fill="#EEF1F5" />
          <circle cx="185" cy="88" r="20" fill="#162033" />
          <circle cx="185" cy="88" r="10" fill="#EEF1F5" />
          {/* Main body */}
          <path
            d="M 20 85 L 20 68 C 20 62 25 58 35 56 L 65 54 L 95 30 C 105 22 145 22 165 30 L 195 54 L 215 56 C 225 58 230 64 230 72 L 230 85 Z"
            fill={tintColor}
            stroke="#162033"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Windows */}
          <path d="M 72 52 L 98 33 L 128 33 L 128 52 Z" fill="#1A2536" opacity="0.85" />
          <path d="M 134 52 L 134 33 L 162 33 L 188 52 Z" fill="#1A2536" opacity="0.85" />
          {/* EV Plug Icon if EV */}
          {normType === 'ev' && (
            <g transform="translate(110, 64)">
              <rect x="0" y="0" width="20" height="14" rx="3" fill="#1E8E52" />
              <path d="M 5 14 L 5 18 M 15 14 L 15 18" stroke="#1E8E52" strokeWidth="3" strokeLinecap="round" />
            </g>
          )}
          {/* Headlight & Taillight */}
          <rect x="222" y="62" width="8" height="10" rx="2" fill="#FFFDE7" />
          <rect x="18" y="62" width="6" height="10" rx="2" fill="#FF1744" />
        </svg>
      )}

      {normType === 'bus' && (
        <svg viewBox="0 0 280 120" className="w-full h-full max-h-[140px] drop-shadow-sm">
          {/* Bus Silhouette */}
          <circle cx="65" cy="92" r="18" fill="#162033" />
          <circle cx="65" cy="92" r="9" fill="#EEF1F5" />
          <circle cx="205" cy="92" r="18" fill="#162033" />
          <circle cx="205" cy="92" r="9" fill="#EEF1F5" />
          <circle cx="235" cy="92" r="18" fill="#162033" />
          <circle cx="235" cy="92" r="9" fill="#EEF1F5" />
          {/* Bus body */}
          <rect
            x="20"
            y="25"
            width="240"
            height="65"
            rx="8"
            fill={tintColor}
            stroke="#162033"
            strokeWidth="3"
          />
          {/* Window band */}
          <rect x="32" y="34" width="216" height="24" rx="4" fill="#1A2536" opacity="0.85" />
          {/* Window vertical dividers */}
          <path d="M 75 34 L 75 58 M 120 34 L 120 58 M 165 34 L 165 58 M 210 34 L 210 58" stroke="#EEF1F5" strokeWidth="2" />
          {/* Headlight & Taillight */}
          <rect x="254" y="65" width="6" height="12" rx="2" fill="#FFFDE7" />
          <rect x="20" y="65" width="5" height="12" rx="2" fill="#FF1744" />
        </svg>
      )}

      {normType === 'other' && (
        <svg viewBox="0 0 200 120" className="w-full h-full max-h-[140px] drop-shadow-sm">
          {/* Auto-rickshaw Silhouette */}
          <circle cx="155" cy="88" r="16" fill="#162033" />
          <circle cx="155" cy="88" r="8" fill="#EEF1F5" />
          <circle cx="55" cy="88" r="16" fill="#162033" />
          <circle cx="55" cy="88" r="8" fill="#EEF1F5" />
          {/* Cabin */}
          <path
            d="M 35 85 L 35 52 C 35 48 40 45 50 45 L 120 45 C 130 45 135 50 140 58 L 165 65 C 172 68 175 75 175 85 Z"
            fill={tintColor}
            stroke="#162033"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Hood top (Yellow canvas roof) */}
          <path d="M 48 45 L 120 45 C 128 45 132 48 136 55 L 48 55 Z" fill="#FBC02D" stroke="#162033" strokeWidth="2" />
          {/* Windscreen */}
          <path d="M 132 55 L 160 62 L 150 78 L 128 75 Z" fill="#1A2536" opacity="0.85" />
          {/* Headlight */}
          <circle cx="170" cy="74" r="5" fill="#FFFDE7" stroke="#162033" strokeWidth="2" />
        </svg>
      )}
    </div>
  )
}
