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
  groundContact?: boolean;
};

const coats: Record<HorseCoat, { base: string; light: string; shade: string; mane: string }> = {
  bay: { base: "#875035", light: "#b77951", shade: "#503326", mane: "#2b2522" },
  chestnut: { base: "#b66b3f", light: "#dc9b65", shade: "#79462e", mane: "#713b26" },
  black: { base: "#383b40", light: "#626970", shade: "#22272d", mane: "#171c22" },
  gray: { base: "#b9b9b2", light: "#ece9dd", shade: "#7c8587", mane: "#596267" },
  palomino: { base: "#c29a59", light: "#edd19a", shade: "#947040", mane: "#f3e3b9" },
};

/** Side-view horse; all motion is CSS and respects reduced-motion preferences. */
export default function Horse({ className = "", coatColor = "bay", maneColor, hasStar = false, socks = [], pose = "standing", facing = "right", size = 190, groundContact = false }: HorseProps) {
  const id = useId().replace(/:/g, "");
  const coat = coats[coatColor];
  const mane = maneColor ?? coat.mane;
  const resting = pose === "lying";
  const leg = (name: HorseLeg, front: boolean, far: boolean) => (
    <g key={name} className={`equine-horse__leg equine-horse__leg--${name}`} fill={far ? coat.shade : `url(#${id}-limb)`} stroke={coat.shade} strokeWidth=".85" strokeLinejoin="round">
      {resting ? <>
        <path d={front ? "M157 120 Q170 132 161 145 L186 158 Q192 165 182 167 L147 156 Q135 145 139 127Z" : "M75 121 Q91 132 80 145 L109 157 Q117 164 108 167 L68 155 Q51 145 58 128Z"} />
        <path d={front ? "M178 158 L190 159 L193 167 L178 167Z" : "M103 158 L116 159 L118 167 L103 167Z"} fill="#292825" />
      </> : <>
        <path d={front ? "M144 108 C154 106 162 117 161 130 Q159 141 157 150 Q160 155 157 162 L155 184 Q158 189 156 195 L158 204 L151 205 L149 195 Q146 190 149 184 L149 163 Q145 158 147 151 L142 132 Q137 120 144 108Z" : "M57 106 C74 100 86 114 82 128 Q79 141 67 151 Q60 157 60 165 L64 183 Q68 188 65 195 L67 204 L60 205 L58 196 Q55 190 58 184 L55 168 Q51 162 55 155 L60 137 Q48 124 57 106Z"} />
        <path d={front ? "M146 117 Q155 119 155 135 L152 146" : "M62 113 Q77 113 76 127 Q74 137 65 145"} fill="none" stroke={coat.light} strokeWidth="1.6" opacity={far ? ".1" : ".3"} strokeLinecap="round" />
        <path d={front ? "M148 153 Q152 150 156 154 M149 160 Q153 163 156 159 M149 188 Q153 186 156 189" : "M56 158 Q59 155 63 158 M56 164 Q58 167 61 166 M59 188 Q63 185 65 189"} fill="none" stroke={coat.shade} strokeWidth=".8" opacity=".45" strokeLinecap="round" />
        <path d={front ? "M151 132 L152 149 M151 165 L153 183 M150 190 Q153 192 155 190" : "M71 128 Q68 141 61 152 M58 164 L61 182 M61 187 L61 197"} fill="none" stroke={coat.light} strokeWidth=".75" opacity=".32" strokeLinecap="round" />
        {socks.includes(name) && <path d={front ? "M150 184 Q153 186 155 184 Q157 190 155 196 L158 203 L151 203 L149 195 Q148 190 150 184Z" : "M59 184 Q61 186 64 184 Q66 189 64 196 L67 203 L60 203 L58 196 Q57 190 59 184Z"} fill="#f2e9d9" stroke="none" />}
        <path d={front ? "M150 201 Q155 200 158 202 L161 208 Q156 210 148 209 L149 205Z" : "M59 201 Q63 200 66 202 L70 208 Q64 210 57 209Z"} fill="#302e29" />
        <path d={front ? "M150 204 L158 204" : "M59 204 L67 204"} stroke="#c6bc9f" strokeWidth=".7" opacity=".5" />
      </>}
    </g>
  );
  return (
    <svg className={`equine-horse equine-horse--${pose} ${className}`} viewBox="0 0 260 230" width={size} style={{ width: size, maxWidth: "100%", height: "auto" }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-coat`} cx="38%" cy="25%" r="85%">
          <stop offset="0" stopColor={coat.light} /><stop offset=".42" stopColor={coat.base} /><stop offset="1" stopColor={coat.shade} />
        </radialGradient>
        <linearGradient id={`${id}-limb`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor={coat.shade} /><stop offset=".45" stopColor={coat.base} /><stop offset=".7" stopColor={coat.light} /><stop offset="1" stopColor={coat.shade} />
        </linearGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop stopColor="#31291d" stopOpacity=".3" /><stop offset="1" stopColor="#31291d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="123" cy="213" rx="100" ry="10" fill={`url(#${id}-shadow)`} />
      <g transform={facing === "left" ? "translate(260 0) scale(-1 1)" : undefined}>
        {groundContact && !resting && <g aria-hidden="true">
          <ellipse cx="123" cy="211" rx="88" ry="7" fill={`url(#${id}-shadow)`} opacity=".65" />
          {[{ x: 64, y: 209 }, { x: 82, y: 206 }, { x: 154, y: 209 }, { x: 163, y: 206 }].map(({ x, y }) => <ellipse key={x} cx={x} cy={y} rx="10" ry="2.5" fill={`url(#${id}-shadow)`} />)}
        </g>}
        <g transform={resting ? "translate(0 45)" : undefined}>
          <g className="equine-horse__tail" fill={mane}>
            <path d="M51 89 C31 88 34 109 32 127 C30 146 22 163 17 175 Q30 170 36 155 C32 171 27 177 22 181 Q42 170 43 145 C44 128 37 108 54 103Z" />
            <path d="M43 104 C35 122 44 146 29 169 M38 111 C36 134 30 154 23 166 M46 107 C40 128 49 148 36 166" fill="none" stroke={coat.light} strokeWidth=".75" opacity=".28" strokeLinecap="round" />
          </g>
        </g>
        <g transform={resting ? undefined : "translate(18 -3)"}>{leg("hindRight", false, true)}</g>
        <g transform={resting ? undefined : "translate(9 -3)"}>{leg("frontRight", true, true)}</g>
        <g className="equine-horse__torso" transform={resting ? "translate(0 45)" : undefined}>
          <path d="M47 103 C47 90 54 82 66 82 C80 81 89 85 103 85 C120 86 132 83 143 80 C156 80 167 92 169 105 C171 118 164 129 153 132 C139 135 125 132 111 131 C95 130 82 133 68 130 C54 128 47 118 47 108Z" fill={`url(#${id}-coat)`} stroke={coat.shade} strokeWidth="1" />
          <path d="M57 87 C71 83 85 89 103 89 Q126 90 143 85" fill="none" stroke={coat.light} strokeWidth="1.2" opacity=".35" strokeLinecap="round" />
          <path d="M60 92 C49 103 53 119 66 123 Q77 125 81 116 M147 91 C135 101 136 119 147 128" fill="none" stroke={coat.shade} strokeWidth=".8" opacity=".22" />
          <path d="M79 96 C96 92 120 94 135 101 Q121 113 85 115Z" fill={coat.light} opacity=".08" />
          <path d="M72 122 C93 127 113 124 130 127 Q145 130 157 123 Q149 134 129 131 C108 127 90 133 72 127Z" fill={coat.shade} opacity=".14" />
          <g className="equine-horse__neck">
            <path d="M133 89 C150 77 156 59 169 44 C176 35 184 34 190 40 L197 53 C182 67 180 87 174 104 Q170 118 158 129 L145 115 Q140 101 133 89Z" fill={`url(#${id}-coat)`} stroke={coat.shade} strokeWidth="1" />
            <path d="M182 53 Q167 77 151 101 Q169 95 178 77" fill={coat.shade} opacity=".17" />
            <path d="M145 88 Q158 75 169 54" fill="none" stroke={coat.light} strokeWidth="2" opacity=".35" strokeLinecap="round" />
            <path d="M185 37 C175 34 168 43 162 53 Q151 72 138 86 L144 89 L150 82 L151 86 L158 75 L158 79 L165 65 L166 69 Q173 47 188 43Z" fill={mane} />
            <path d="M179 40 Q164 51 156 72 M174 44 Q164 58 159 70 M166 58 L151 82" fill="none" stroke={coat.light} strokeWidth=".7" opacity=".3" />
            <g className="equine-horse__head" transform="translate(16 11) scale(.96 1)">
              <path d="M178 34 L175 19 Q180 19 184 32 M187 32 L191 18 Q196 23 193 37" fill={coat.base} stroke={coat.shade} strokeWidth="1.1" />
              <path d="M177 32 C184 28 193 31 199 40 L212 58 Q216 64 223 67 Q228 72 223 76 Q219 79 214 76 L204 69 L193 64 C185 67 178 61 176 52 Q174 40 177 32Z" fill={`url(#${id}-coat)`} stroke={coat.shade} strokeWidth="1" />
              <path d="M180 31 L178 23 M190 31 L192 23" stroke={coat.shade} strokeWidth="1.2" strokeLinecap="round" />
              <path d="M199 45 L216 66" stroke={coat.light} strokeWidth="1" opacity=".35" />
              <path d="M217 64 Q220 66 223 67 Q228 72 223 76 Q219 78 214 75 L211 71Z" fill={coat.shade} opacity=".36" />
              <path d="M181 49 Q179 59 188 62 Q192 63 194 59 M216 74 L222 74" fill="none" stroke={coat.shade} strokeWidth=".75" opacity=".6" strokeLinecap="round" />
              <path d="M185 44 Q190 41 195 44" fill="none" stroke={coat.shade} strokeWidth="1" />
              <ellipse className="equine-horse__eye" cx="191" cy="44" rx="1.8" ry="1.4" fill="#191d1d" /><circle cx="191.5" cy="43.6" r=".45" fill="#eee9d8" />
              <ellipse cx="221" cy="69.5" rx="2" ry="1.3" transform="rotate(-28 221 69.5)" fill="#292825" />
              <path d="M177 32 Q185 27 192 33 L187 34 L183 40Z" fill={mane} />
              {hasStar && <path d="M199 43 L202 47 L201 52 L197 48 L196 45Z" fill="#fff5e3" />}
            </g>
          </g>
        </g>
        {leg("hindLeft", false, false)}{leg("frontLeft", true, false)}
        {groundContact && !resting && <g fill="none" strokeLinecap="round" aria-hidden="true">
          <path d="m54 210 7-3m3 4 5-7m8 4 8-3m60 6 8-4m4 3 5-6m-111 8 5 1m105-5 7-2" stroke="#8b713e" strokeWidth="1.6" opacity=".55" />
          <path d="m55 209 6-3m4 4 4-7m9 4 7-3m61 6 7-4m5 3 4-6m-110 8 4 1m106-5 6-2" stroke="#dfc58b" strokeWidth=".9" opacity=".9" />
        </g>}
      </g>
    </svg>
  );
}
