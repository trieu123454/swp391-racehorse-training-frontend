"use client";

import { useId } from "react";

export type HorseCoat = "bay" | "chestnut" | "black" | "gray" | "palomino";
export type HorseLeg = "frontLeft" | "frontRight" | "hindLeft" | "hindRight";
export type HorsePose = "standing" | "eating" | "lying" | "sick";
export type HorseProps = {
  className?: string;
  coatColor?: HorseCoat;
  maneColor?: string;
  hasStar?: boolean;
  socks?: readonly HorseLeg[];
  pose?: HorsePose;
  facing?: "left" | "right";
  size?: number | string;
};

const coats: Record<HorseCoat, { base: string; light: string; shade: string; mane: string }> = {
  bay: { base: "#875035", light: "#b77951", shade: "#503326", mane: "#2b2522" },
  chestnut: { base: "#b66b3f", light: "#dc9b65", shade: "#79462e", mane: "#713b26" },
  black: { base: "#383b40", light: "#626970", shade: "#22272d", mane: "#171c22" },
  gray: { base: "#b9b9b2", light: "#ece9dd", shade: "#7c8587", mane: "#596267" },
  palomino: { base: "#c29a59", light: "#edd19a", shade: "#947040", mane: "#f3e3b9" },
};

/** Side-view horse; all motion is CSS and respects reduced-motion preferences. */
export default function Horse({ className = "", coatColor = "bay", maneColor, hasStar = false, socks = [], pose = "standing", facing = "right", size = 190 }: HorseProps) {
  const id = useId().replace(/:/g, "");
  const coat = coats[coatColor];
  const mane = maneColor ?? coat.mane;
  const resting = pose === "lying";
  const leg = (name: HorseLeg, front: boolean, far: boolean) => (
    <g key={name} className={`equine-horse__leg equine-horse__leg--${name}`} fill={far ? coat.shade : coat.base} stroke={coat.shade} strokeWidth="1.5" strokeLinejoin="round">
      {resting ? <>
        <path d={front ? "M157 120 Q170 132 161 145 L186 158 Q192 165 182 167 L147 156 Q135 145 139 127Z" : "M75 121 Q91 132 80 145 L109 157 Q117 164 108 167 L68 155 Q51 145 58 128Z"} />
        <path d={front ? "M178 158 L190 159 L193 167 L178 167Z" : "M103 158 L116 159 L118 167 L103 167Z"} fill="#292825" />
      </> : <>
        <path d={front ? "M155 104 Q163 118 160 136 L158 157 L161 183 L158 205 L149 205 L150 181 L147 157 L146 132 L141 114Z" : "M70 106 Q87 119 79 137 L65 155 L74 174 L68 204 L59 204 L62 175 L52 157 Q52 151 57 144 L63 130 L56 116Z"} />
        <path d={front ? "M149 151 Q153 156 159 154 M150 185 L160 185" : "M54 154 Q59 160 66 156 M61 185 L71 185"} fill="none" opacity=".65" />
        {socks.includes(name) && <path d={front ? "M151 184 L160 184 L158 204 L149 204Z" : "M62 184 L71 184 L68 204 L59 204Z"} fill="#f2e9d9" stroke="none" />}
        <path d={front ? "M148 201 L159 201 L165 209 Q158 212 146 210Z" : "M58 201 L69 201 L74 209 Q65 212 55 210Z"} fill="#292825" />
      </>}
    </g>
  );
  return (
    <svg className={`equine-horse equine-horse--${pose} ${className}`} viewBox="0 0 260 230" width={size} style={{ width: size, maxWidth: "100%", height: "auto" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-coat`} x1="0" y1="0" x2="30%" y2="100%" >
          <stop offset="0" stopColor={coat.light} /><stop offset=".48" stopColor={coat.base} /><stop offset="1" stopColor={coat.shade} />
        </linearGradient>
      </defs>
      <ellipse cx="125" cy="216" rx="91" ry="5" fill="#72522e" opacity=".15" />
      <g transform={facing === "left" ? "translate(260 0) scale(-1 1)" : undefined}>
        <g transform={resting ? "translate(0 45)" : undefined}>
          <g className="equine-horse__tail" fill={mane}>
            <path d="M57 91 Q32 86 34 116 Q36 145 17 163 Q45 158 46 129 Q43 110 61 107Z" />
            <path d="M45 110 Q46 151 25 173 Q54 156 52 120Z" opacity=".7" />
            <path d="M40 113 Q32 140 16 148" fill="none" stroke={coat.light} strokeWidth="2" opacity=".4" />
          </g>
        </g>
        <g transform={resting ? undefined : "translate(13 -3)"}>{leg("hindRight", false, true)}{leg("frontRight", true, true)}</g>
        <g className="equine-horse__torso" transform={resting ? "translate(0 45)" : undefined}>
          <path d="M49 101 Q52 78 75 77 Q96 80 116 78 L142 76 Q160 80 168 99 Q173 120 160 135 Q143 144 122 140 L82 137 Q57 135 50 119Z" fill={`url(#${id}-coat)`} stroke={coat.shade} strokeWidth="2" />
          <path d="M70 86 Q89 83 118 87 L139 84" fill="none" stroke={coat.light} strokeWidth="4" opacity=".55" strokeLinecap="round" />
          <path d="M70 117 Q91 137 123 133 L148 127 Q130 143 87 135Z" fill={coat.shade} opacity=".28" />
          <path d="M148 87 Q135 103 148 127 M64 89 Q78 102 71 121" fill="none" stroke={coat.shade} opacity=".4" strokeWidth="2" />
          <g className="equine-horse__neck">
            <path d="M135 87 Q151 71 159 47 Q164 30 176 29 L190 43 Q182 57 181 76 Q181 105 162 125 L147 115Z" fill={`url(#${id}-coat)`} stroke={coat.shade} strokeWidth="2" />
            <path d="M146 85 Q161 66 168 43" fill="none" stroke={coat.light} strokeWidth="4" opacity=".5" />
            <path d="M158 57 Q155 72 146 88 L140 83 Q150 65 155 48 Q160 28 176 26 L181 32 Q166 34 164 49 L162 63Z" fill={mane} />
            <path d="M171 31 Q161 45 159 63 M168 38 L153 77" fill="none" stroke={coat.light} strokeWidth="1.5" opacity=".3" />
            <g className="equine-horse__head">
              <path d="M177 34 L173 13 Q179 12 184 31 M187 31 L190 12 Q196 15 194 37" fill={coat.base} stroke={coat.shade} strokeWidth="1.5" />
              <path d="M177 31 Q188 26 199 38 L212 54 L230 65 Q236 73 228 80 L214 80 L196 69 Q182 71 176 57 Q171 45 177 31Z" fill={`url(#${id}-coat)`} stroke={coat.shade} strokeWidth="2" />
              <path d="M215 61 L231 66 Q237 74 228 79 L216 77 L210 69Z" fill={coat.shade} opacity=".6" />
              <path d="M184 55 Q182 68 197 66 M218 75 L227 75" fill="none" stroke={coat.shade} strokeWidth="1.7" strokeLinecap="round" />
              <ellipse className="equine-horse__eye" cx="194" cy="43" rx="2.6" ry="3" fill="#191d1d" /><circle cx="195" cy="42" r=".8" fill="white" />
              <ellipse cx="227" cy="69" rx="2.2" ry="1.7" fill="#292825" />
              <path d="M177 30 Q190 23 197 37 L187 34 L183 43Z" fill={mane} />
              {hasStar && <path d="M202 44 L205 48 L204 55 L200 51 L198 47Z" fill="#fff5e3" />}
            </g>
          </g>
        </g>
        {leg("hindLeft", false, false)}{leg("frontLeft", true, false)}
      </g>
    </svg>
  );
}
