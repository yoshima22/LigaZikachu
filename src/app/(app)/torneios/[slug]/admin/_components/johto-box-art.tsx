import { type CSSProperties } from "react";
import { JOHTO_BOXES, type JohtoBoxTier } from "@/lib/johto-reward-boxes";
import styles from "./johto-rewards.module.css";

/** CSS/SVG art keeps the lid, light and box independently animatable. */
export function JohtoBoxArt({ tier, opening = false, small = false }: { tier: JohtoBoxTier; opening?: boolean; small?: boolean }) {
  const color = JOHTO_BOXES[tier].color;
  return (
    <div aria-hidden="true" className={`${styles.boxArt} ${opening ? styles.boxOpening : ""} ${small ? styles.smallArt : ""}`} style={{ "--johto-accent": color } as CSSProperties}>
      <div className={styles.boxHalo} />
      <div className={styles.boxBeam} />
      <svg viewBox="0 0 280 250" fill="none" className={styles.boxSvg}>
        <ellipse cx="140" cy="222" rx="94" ry="13" fill="black" opacity=".35" />
        <g className={styles.boxBody}>
          <path d="M39 116 140 143 241 116V194L140 229 39 194Z" fill="#151e36" stroke={color} strokeWidth="2" />
          <path d="m140 143 101-27v78l-101 35Z" fill={color} fillOpacity=".16" />
          <path d="M55 133v49l69 24v-49M156 157v49l69-24v-49" stroke={color} strokeOpacity=".4" strokeWidth="2" />
          <path d="M127 141v83m26-83v83" stroke={color} strokeOpacity=".6" strokeWidth="3" />
          <path d="m140 162 18 11v21l-18 12-18-12v-21Z" fill="#0b1020" stroke={color} strokeWidth="2" />
          <circle cx="140" cy="183" r="9" fill={color} />
          <path d="m135 183 4 4 7-9" stroke="#15213b" strokeWidth="3" />
          <path d="m44 177 13 5m166 0 13-5M44 188l13 5m166 0 13-5" stroke={color} strokeWidth="3" />
        </g>
        <g className={styles.boxLid}>
          <path d="m33 106 107-38 107 38v20l-107 34-107-34Z" fill="#263352" stroke={color} strokeWidth="2" />
          <path d="m33 106 107 33 107-33-107-38Z" fill={color} fillOpacity=".22" stroke={color} strokeWidth="2" />
          <path d="m140 139 107-33v20l-107 34Z" fill="#0b1020" fillOpacity=".65" />
          <path d="m78 92 105 34m-87 22 107-37" stroke={color} strokeOpacity=".7" strokeWidth="6" />
          <path d="m140 89 20 13-20 12-20-12Z" fill="#0b1020" stroke={color} />
          <path d="m140 95 10 7-10 6-10-6Z" fill={color} />
          {tier === "special" && <path d="m124 78-5-16 13 7 8-17 8 17 13-7-5 16Z" fill={color} />}
          {tier === "rare" && <path d="m140 54 7 13-7 12-7-12Z" fill={color} />}
        </g>
      </svg>
      <div className={styles.boxSparkles}><span>✦</span><span>✧</span><span>✦</span><span>✧</span></div>
    </div>
  );
}
