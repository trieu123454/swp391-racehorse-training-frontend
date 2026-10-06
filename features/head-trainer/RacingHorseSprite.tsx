type RacingHorseSpriteProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  className?: string;
};

export default function RacingHorseSprite({ x, y, width, height, className = "h-full w-full" }: RacingHorseSpriteProps) {
  return <svg x={x} y={y} width={width} height={height} aria-hidden="true" viewBox="0 0 120 72" className={`racing-horse ${className}`}>
    <ellipse cx="57" cy="65" rx="39" ry="3" fill="#75583b" opacity=".16" />
    <g className="racing-horse__tail">
      <path d="M31 29 C21 25 19 18 13 16 C16 24 12 28 8 34 C15 33 20 31 24 37" fill="none" stroke="#39241d" strokeWidth="4" strokeLinecap="round" />
    </g>
    <g className="racing-horse__leg racing-horse__leg--hind-a">
      <path d="M38 37 C36 44 30 49 25 55 L20 60" fill="none" stroke="#60351f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 60 L22 60 L20 63 L15 63 Z" fill="#34251e" />
    </g>
    <g className="racing-horse__leg racing-horse__leg--hind-b">
      <path d="M48 38 C48 45 52 50 57 55 L61 60" fill="none" stroke="#87502e" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M58 60 L64 60 L64 63 L59 63 Z" fill="#34251e" />
    </g>
    <g className="racing-horse__body">
      <path d="M28 25 C34 18 45 17 57 19 C68 20 76 25 78 31 C79 36 72 40 63 41 L39 39 C31 37 25 31 28 25Z" fill="#99542f" />
      <path d="M55 22 C62 20 70 23 76 28 L70 34 C64 31 58 31 51 32Z" fill="#b36a3b" opacity=".75" />
      <path d="M64 30 C67 23 69 13 77 8 C82 5 88 7 93 10 L91 16 C86 15 83 18 82 23 L79 35 L71 39Z" fill="#8d4b2a" />
      <path d="M76 11 C80 4 82 2 85 1 L86 10 C90 4 93 4 96 5 L94 13 L88 19 L82 21Z" fill="#38251e" />
      <path d="M86 10 C91 5 98 6 103 9 L114 9 L109 14 L116 17 L109 21 L100 18 C96 22 91 21 86 18Z" fill="#99542f" />
      <path d="M100 9 C102 12 102 15 100 18" fill="none" stroke="#f3e4cf" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="105" cy="12" r="1.2" fill="#201a17" />
      <path d="M113 16 L117 17" stroke="#38251e" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M56 22 C62 18 70 19 75 24 L69 29 L57 29Z" fill="#d19a4e" />
      <path d="M59 21 L70 21" stroke="#f3d18d" strokeWidth="1.5" />
    </g>
    <g className="racing-horse__leg racing-horse__leg--fore-a">
      <path d="M74 35 C75 42 82 47 88 52 L93 59" fill="none" stroke="#99542f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M90 59 L97 59 L97 62 L92 62 Z" fill="#34251e" />
    </g>
    <g className="racing-horse__leg racing-horse__leg--fore-b">
      <path d="M81 35 C85 42 82 49 77 55 L74 60" fill="none" stroke="#784329" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M71 60 L78 60 L77 63 L72 63 Z" fill="#34251e" />
    </g>
  </svg>;
}
