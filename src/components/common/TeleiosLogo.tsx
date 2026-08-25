import React from 'react';

interface TeleiosLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'horizontal';
  lightMode?: boolean;
}

export const TeleiosLogo: React.FC<TeleiosLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  lightMode = false,
}) => {
  // Dimensions
  const sizeMap = {
    sm: { width: 140, height: 50, iconSize: 36 },
    md: { width: 220, height: 80, iconSize: 48 },
    lg: { width: 320, height: 110, iconSize: 64 },
    xl: { width: 420, height: 140, iconSize: 96 },
  };

  const currentSize = sizeMap[size];

  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`w-${size === 'sm' ? '8' : size === 'lg' ? '14' : size === 'xl' ? '20' : '10'} h-${
          size === 'sm' ? '8' : size === 'lg' ? '14' : size === 'xl' ? '20' : '10'
        } ${className}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Golden Star */}
        <path
          d="M82 18L84.5 24.5L91 27L84.5 29.5L82 36L79.5 29.5L73 27L79.5 24.5L82 18Z"
          fill="#F5A800"
        />
        <path
          d="M82 22L83.5 25.5L87 27L83.5 28.5L82 32L80.5 28.5L77 27L80.5 25.5L82 22Z"
          fill="#FFD24D"
        />

        {/* Person Head - Coral */}
        <circle cx="70" cy="22" r="6" fill="#E85025" />

        {/* Teal Green Figure reaching up */}
        <path
          d="M56 25C60 25 63 29 65 34C60 37 57 41 55 48C51 45 48 39 49 33C50 28 53 25 56 25Z"
          fill="#009B77"
        />

        {/* Upper Blue Swoosh */}
        <path
          d="M15 54C28 42 46 36 65 34C68 39 68 44 65 48C48 48 32 54 15 54Z"
          fill="#0F2B5C"
        />

        {/* Cyan / Light Blue Swoosh */}
        <path
          d="M12 58C28 47 48 43 65 43C62 48 58 53 52 57C36 57 23 61 12 58Z"
          fill="#0077C8"
        />

        {/* Golden Yellow Accent Swoosh */}
        <path
          d="M24 61C36 55 50 53 62 53C58 57 52 61 44 65C34 65 27 63 24 61Z"
          fill="#F5A800"
        />

        {/* Lower Coral Orange Swoosh */}
        <path
          d="M32 64C46 64 62 60 76 46C80 54 78 64 68 70C54 76 40 73 32 64Z"
          fill="#E85025"
        />
      </svg>
    );
  }

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* SVG Logomark & Wordmark */}
      <svg
        viewBox="0 0 400 240"
        className="w-full h-auto max-w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* DEFINITIONS FOR GRADIENTS */}
        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F5A800" />
            <stop offset="100%" stopColor="#E08B00" />
          </linearGradient>
          <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F2B5C" />
            <stop offset="100%" stopColor="#0077C8" />
          </linearGradient>
          <linearGradient id="coralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E85025" />
            <stop offset="100%" stopColor="#D43A10" />
          </linearGradient>
        </defs>

        {/* 1. Golden Star */}
        <path
          d="M320 25L325 38L338 43L325 48L320 61L315 48L302 43L315 38L320 25Z"
          fill="url(#goldGrad)"
        />
        <path
          d="M320 33L323 39L329 43L323 47L320 53L317 47L311 43L317 39L320 33Z"
          fill="#FFEB99"
        />

        {/* 2. Head of Figure - Coral Orange */}
        <circle cx="280" cy="40" r="13" fill="#E85025" />

        {/* 3. Figure Body / Reaching Arms - Emerald Green */}
        <path
          d="M225 46C242 46 256 56 265 67C246 76 235 88 228 106C218 97 208 81 211 66C214 53 219 46 225 46Z"
          fill="#009B77"
        />

        {/* 4. Upper Swoosh - Deep Royal Blue */}
        <path
          d="M50 115C105 84 185 70 265 67C272 78 270 90 262 98C195 98 128 114 50 115Z"
          fill="#0F2B5C"
        />

        {/* 5. Second Swoosh - Vivid Sky Blue */}
        <path
          d="M65 124C115 98 190 88 260 88C252 100 238 110 215 118C152 118 105 129 65 124Z"
          fill="#0077C8"
        />

        {/* 6. Third Swoosh - Golden Amber */}
        <path
          d="M100 133C148 116 200 110 248 110C235 120 215 129 180 138C142 138 116 135 100 133Z"
          fill="#F5A800"
        />

        {/* 7. Lower Outer Swoosh - Coral Orange */}
        <path
          d="M130 140C185 140 250 128 310 94C322 114 316 138 288 152C236 166 178 160 130 140Z"
          fill="#E85025"
        />

        {/* 8. Text: "MINISTÉRIO" */}
        <text
          x="285"
          y="136"
          fontFamily="'Cinzel', 'Trajan Pro', Georgia, serif"
          fontSize="14"
          fontWeight="bold"
          letterSpacing="4"
          fill={lightMode ? '#F4F1ED' : '#0F2B5C'}
        >
          MINISTÉRIO
        </text>

        {/* Dot above i */}
        <circle cx="245" cy="140" r="8" fill="#0F2B5C" />

        {/* 9. Text: "Teleios" in signature script/calligraphic serif */}
        <text
          x="40"
          y="190"
          fontFamily="'Playfair Display', 'Cormorant Garamond', 'Baskerville', Georgia, serif"
          fontSize="68"
          fontWeight="700"
          fontStyle="italic"
          fill={lightMode ? '#FFFFFF' : '#0F2B5C'}
          letterSpacing="-1"
        >
          Teleios
        </text>

        {/* 10. Golden Laurel Leaf Left */}
        <g fill="#F5A800" transform="translate(10, 175) scale(0.7)">
          <path d="M10 25C15 20 25 22 28 28C22 30 14 30 10 25Z" />
          <path d="M18 15C25 12 32 17 33 24C27 24 20 22 18 15Z" />
          <path d="M30 8C37 8 42 15 40 22C35 20 30 16 30 8Z" />
          <path d="M42 2C48 4 50 12 46 19C42 16 39 10 42 2Z" />
        </g>

        {/* 11. Slogan: "Cristo é meu Salvador" */}
        <text
          x="200"
          y="225"
          textAnchor="middle"
          fontFamily="'Playfair Display', 'Cormorant Garamond', Georgia, serif"
          fontSize="22"
          fontWeight="bold"
          fontStyle="italic"
          fill={lightMode ? '#FFD24D' : '#0F2B5C'}
          letterSpacing="1"
        >
          Cristo é meu Salvador
        </text>

        {/* 12. Golden Laurel Leaf Right */}
        <g fill="#F5A800" transform="translate(340, 175) scale(0.7) scale(-1, 1)">
          <path d="M10 25C15 20 25 22 28 28C22 30 14 30 10 25Z" />
          <path d="M18 15C25 12 32 17 33 24C27 24 20 22 18 15Z" />
          <path d="M30 8C37 8 42 15 40 22C35 20 30 16 30 8Z" />
          <path d="M42 2C48 4 50 12 46 19C42 16 39 10 42 2Z" />
        </g>
      </svg>
    </div>
  );
};
