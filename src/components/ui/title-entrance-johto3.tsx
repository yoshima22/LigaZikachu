"use client";

import type { ReactNode } from "react";

export type Johto3Tier = "FIRST" | "SECOND" | "THIRD" | "CHAMPION" | "FOURTH";

interface Props { tier: Johto3Tier; name: string; flavorText?: string | null; }
type EffectProps = Omit<Props, "tier">;

function Scene({ placement, direction, children }: { placement: string; direction: string; children: ReactNode }) {
  return <><style>{CSS}</style><section className={"j3-stage j3-" + placement} data-placement={placement} data-art-direction={direction}>{children}</section></>;
}

function CinematicCopy({ label, name, flavorText }: EffectProps & { label: string }) {
  return <div className="j3-cinematic-copy">
    <p className="j3-kicker">{label}<span>Johto Zikachu III</span></p>
    <h2>{name}</h2>
    {flavorText && <p className="j3-flavor">&ldquo;{flavorText}&rdquo;</p>}
  </div>;
}

function FirstPlaceEffect({ name, flavorText }: EffectProps) {
  return <Scene placement="first" direction="royal-procession">
    <div className="j3-vignette" /><div className="first-spot first-spot-left" /><div className="first-spot first-spot-right" />
    <svg className="first-laurel" viewBox="0 0 600 300" aria-hidden="true">
      <path d="M270 256C181 239 113 180 81 86c39 17 67 43 87 75-11-48-5-91 19-125 18 37 27 76 17 115 22-35 50-60 84-76" />
      <path d="M330 256C419 239 487 180 519 86c-39 17-67 43-87 75 11-48 5-91-19-125-18 37-27 76-17 115-22-35-50-60-84-76" />
    </svg>
    <svg className="first-crown" viewBox="0 0 180 98" aria-hidden="true"><path d="M20 78 10 20l38 28L70 9l20 39 20-39 22 39 38-28-10 58z" /><path d="M25 85h130" /></svg>
    <div className="first-medal"><span>1º</span></div>
    <div className="first-glint first-glint-a" /><div className="first-glint first-glint-b" />
    <CinematicCopy label="1º Lugar" name={name} flavorText={flavorText} />
  </Scene>;
}

function SecondPlaceEffect({ name, flavorText }: EffectProps) {
  return <Scene placement="second" direction="silver-spotlight">
    <div className="j3-vignette" /><div className="second-wash" /><div className="second-spot second-spot-left" /><div className="second-spot second-spot-right" />
    <svg className="second-ribbon" viewBox="0 0 700 310" aria-hidden="true"><path d="M-20 230C150 76 254 322 352 142S577 86 720 10" /><path d="M-20 258C160 104 264 350 370 169S588 111 720 38" /></svg>
    <div className="second-medal"><span>2º</span></div><div className="second-arc second-arc-a" /><div className="second-arc second-arc-b" />
    <CinematicCopy label="2º Lugar" name={name} flavorText={flavorText} />
  </Scene>;
}

function ThirdPlaceEffect({ name, flavorText }: EffectProps) {
  return <Scene placement="third" direction="bronze-podium">
    <div className="j3-vignette" /><div className="third-ember third-ember-a" /><div className="third-ember third-ember-b" /><div className="third-ember third-ember-c" />
    <svg className="third-podium" viewBox="0 0 700 280" aria-hidden="true"><path d="M44 244h612M133 244V176h135v68m164 0V104h135v140M285 244V142h130v102" /><path d="M133 176h135m17-34h130m17-38h135" /></svg>
    <div className="third-medal"><span>3º</span></div><div className="third-flare" />
    <CinematicCopy label="3º Lugar" name={name} flavorText={flavorText} />
  </Scene>;
}

function FourthPlaceEffect({ name, flavorText }: EffectProps) {
  return <Scene placement="fourth" direction="emerald-arc">
    <div className="j3-vignette" /><div className="fourth-aura" />
    <svg className="fourth-rings" viewBox="0 0 700 330" aria-hidden="true"><ellipse cx="350" cy="165" rx="220" ry="84" /><ellipse cx="350" cy="165" rx="166" ry="61" /><ellipse cx="350" cy="165" rx="112" ry="39" /></svg>
    <svg className="fourth-mark" viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="63" /><path d="M50 92c17-49 43-70 67-76-4 29-16 61-48 91 15-4 28-4 40 0-19 18-41 28-66 30" /></svg>
    <div className="fourth-number">4º</div>
    <CinematicCopy label="4º Lugar" name={name} flavorText={flavorText} />
  </Scene>;
}

function CupChampionEffect({ name, flavorText }: EffectProps) {
  return <Scene placement="cup-champion" direction="cup-coronation">
    <div className="j3-vignette" /><div className="cup-drape cup-drape-left" /><div className="cup-drape cup-drape-right" /><div className="cup-halo" />
    <svg className="cup-trophy" viewBox="0 0 180 220" aria-hidden="true"><path d="M43 24h94v37c0 41-19 64-47 70-28-6-47-29-47-70z" /><path d="M43 39H18c0 40 18 61 43 61M137 39h25c0 40-18 61-43 61M90 131v39M59 191h62M68 170h44" /><path className="cup-star" d="m90 52 8 20 21 1-16 14 5 21-18-11-18 11 5-21-16-14 21-1z" /></svg>
    <svg className="cup-crown" viewBox="0 0 170 82" aria-hidden="true"><path d="m12 62 9-47 30 25L72 7l13 33L98 7l21 33 30-25 9 47z" /><path d="M16 70h138" /></svg>
    <CinematicCopy label="Campeão da Copa Johto" name={name} flavorText={flavorText} />
  </Scene>;
}

export function Johto3PlacementEffect({ tier, name, flavorText }: Props) {
  const props = { name, flavorText };
  switch (tier) {
    case "FIRST": return <FirstPlaceEffect {...props} />;
    case "SECOND": return <SecondPlaceEffect {...props} />;
    case "THIRD": return <ThirdPlaceEffect {...props} />;
    case "FOURTH": return <FourthPlaceEffect {...props} />;
    case "CHAMPION": return <CupChampionEffect {...props} />;
  }
}

const CSS = [
".j3-stage{position:absolute;inset:0;overflow:hidden;isolation:isolate;font-family:Georgia,'Times New Roman',serif}.j3-stage *{box-sizing:border-box}.j3-vignette{position:absolute;inset:0;z-index:10;pointer-events:none;background:radial-gradient(ellipse at 50% 38%,transparent 22%,#05080b44 54%,#020305dd 100%)}.j3-cinematic-copy{position:absolute;z-index:20;left:50%;bottom:9%;width:min(760px,92vw);color:#fff;transform:translateX(-50%) translateY(24px);opacity:0;text-align:center;animation:j3-copy-rise .7s cubic-bezier(.16,1,.3,1) .5s forwards}.j3-cinematic-copy h2{margin:8px 0 0;font-size:clamp(31px,7.2vw,62px);font-weight:700;line-height:1;letter-spacing:-.035em;text-wrap:balance}.j3-kicker{display:inline-flex;gap:13px;align-items:center;margin:0;color:currentColor;font-family:Arial,sans-serif;font-size:clamp(9px,1.7vw,12px);font-weight:800;letter-spacing:.26em;text-transform:uppercase}.j3-kicker:before,.j3-kicker:after{content:'';width:clamp(25px,8vw,78px);height:1px;background:currentColor;opacity:.7}.j3-kicker span{opacity:.64}.j3-flavor{margin:12px auto 0;max-width:580px;font-size:clamp(13px,2.4vw,16px);font-style:italic;line-height:1.45;opacity:.86}@keyframes j3-copy-rise{to{opacity:1;transform:translateX(-50%) translateY(0)}}",
".j3-first{background:radial-gradient(ellipse at 50% 42%,#8c661b 0,#2a1b06 44%,#050505 100%);color:#ffe8a1}.first-spot{position:absolute;top:-45%;width:20vw;height:125%;opacity:0;transform-origin:top;background:linear-gradient(#fff9d200, #ffe9953b 47%,transparent);filter:blur(1px);animation:first-spot 1.2s ease-out .08s forwards}.first-spot-left{left:17%;transform:rotate(19deg)}.first-spot-right{right:17%;transform:rotate(-19deg)}.first-laurel{position:absolute;z-index:2;left:50%;top:7%;width:min(620px,90vw);transform:translateX(-50%) scale(.82);fill:none;stroke:#f6c74d;stroke-width:7;stroke-linecap:round;stroke-dasharray:660;stroke-dashoffset:660;filter:drop-shadow(0 0 13px #e69c2a88);animation:first-draw 1.1s cubic-bezier(.2,.8,.3,1) .14s forwards}.first-crown{position:absolute;z-index:4;left:50%;top:12%;width:min(174px,29vw);transform:translateX(-50%) translateY(-38px);opacity:0;fill:#f6cf61;stroke:#fff0b1;stroke-width:4;stroke-linejoin:round;filter:drop-shadow(0 0 16px #f3b42b);animation:first-crown .56s cubic-bezier(.2,1.35,.3,1) .62s forwards}.first-medal{position:absolute;z-index:3;left:50%;top:35%;display:grid;place-items:center;width:clamp(122px,21vw,178px);aspect-ratio:1;border:3px solid #fff0b2;border-radius:50%;background:radial-gradient(circle at 35% 28%,#fff8d0,#e9af32 49%,#7c4808);box-shadow:0 0 0 8px #d9911e35,0 0 45px #ffca4b99;color:#513100;font-family:Arial,sans-serif;font-size:clamp(67px,12vw,110px);font-weight:900;text-shadow:0 1px #fff4c2;transform:translate(-50%,-50%) scale(.4);opacity:0;animation:first-medal .65s cubic-bezier(.18,1.4,.32,1) .38s forwards}.first-glint{position:absolute;z-index:4;width:8px;aspect-ratio:1;background:#fff7cb;box-shadow:0 0 14px 5px #f8c94e;opacity:0;animation:first-glint 1.4s ease-in-out infinite}.first-glint-a{left:27%;top:31%;animation-delay:.78s}.first-glint-b{right:27%;top:25%;animation-delay:1.2s}.j3-first .j3-cinematic-copy{text-shadow:0 2px 0 #573400,0 0 26px #f1af2d}@keyframes first-spot{to{opacity:1}}@keyframes first-draw{to{stroke-dashoffset:0}}@keyframes first-crown{to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes first-medal{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}@keyframes first-glint{0%,100%{opacity:0;transform:scale(.4)}45%{opacity:1;transform:scale(1)}}",
".j3-second{background:radial-gradient(ellipse at 50% 44%,#375875 0,#132231 49%,#05080d 100%);color:#eaf7ff}.second-wash{position:absolute;inset:-30%;background:radial-gradient(ellipse at 50% 44%,#c6efff26,transparent 48%);opacity:0;animation:second-wash 1.3s ease-out forwards}.second-spot{position:absolute;top:-42%;width:18vw;height:130%;background:linear-gradient(#fff0,#d7f5ff2a 52%,transparent);opacity:0;transform-origin:top;animation:second-spot 1s ease-out .12s forwards}.second-spot-left{left:25%;transform:rotate(27deg)}.second-spot-right{right:25%;transform:rotate(-27deg)}.second-ribbon{position:absolute;z-index:2;left:50%;top:10%;width:min(760px,110vw);transform:translateX(-50%);fill:none;stroke:#d7f4ff;stroke-width:3;opacity:0;filter:drop-shadow(0 0 10px #a4e6ff);animation:second-ribbon 1.15s ease-out .18s forwards}.second-ribbon path:first-child{stroke-width:9;opacity:.22}.second-medal{position:absolute;z-index:3;left:50%;top:35%;display:grid;place-items:center;width:clamp(120px,20vw,170px);aspect-ratio:1;border:3px solid #e9f9ff;border-radius:50%;background:linear-gradient(140deg,#f8feff 5%,#abc9dc 46%,#5d819c 100%);box-shadow:0 0 42px #91d9ff77,inset 8px 8px 20px #fff9;color:#294a63;font-family:Arial,sans-serif;font-size:clamp(66px,12vw,107px);font-weight:900;transform:translate(-50%,-50%) scale(.45);opacity:0;animation:second-medal .7s cubic-bezier(.16,1.35,.3,1) .38s forwards}.second-arc{position:absolute;z-index:2;left:50%;top:35%;border:1px solid #c8efff75;border-radius:50%;transform:translate(-50%,-50%) scale(.5);opacity:0;animation:second-arc 1.5s ease-out .48s forwards}.second-arc-a{width:clamp(225px,42vw,355px);height:clamp(115px,21vw,175px)}.second-arc-b{width:clamp(295px,54vw,465px);height:clamp(152px,28vw,235px);animation-delay:.62s}.j3-second .j3-cinematic-copy{text-shadow:0 2px #1c3d57,0 0 25px #91d9ff}@keyframes second-wash{to{opacity:1}}@keyframes second-spot{to{opacity:1}}@keyframes second-ribbon{to{opacity:.9}}@keyframes second-medal{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}@keyframes second-arc{0%{opacity:.75;transform:translate(-50%,-50%) scale(.5)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.25)}}",
".j3-third{background:radial-gradient(ellipse at 50% 42%,#65351c 0,#27130c 50%,#050303 100%);color:#f7d0aa}.third-podium{position:absolute;z-index:2;left:50%;bottom:24%;width:min(760px,106vw);transform:translateX(-50%) translateY(34px);fill:none;stroke:#db8750;stroke-width:4;opacity:0;filter:drop-shadow(0 0 10px #d56734);animation:third-podium .7s ease-out .1s forwards}.third-podium path:last-child{stroke:#ffd4a6;stroke-width:2;opacity:.7}.third-medal{position:absolute;z-index:4;left:50%;top:35%;display:grid;place-items:center;width:clamp(116px,19vw,162px);aspect-ratio:1;border:3px solid #ffd3a4;border-radius:50%;background:radial-gradient(circle at 34% 26%,#ffe0bc,#bc6438 51%,#5c2411);box-shadow:0 0 36px #eb793f77;color:#4b1d0d;font-family:Arial,sans-serif;font-size:clamp(64px,11vw,101px);font-weight:900;transform:translate(-50%,-50%) scale(.5);opacity:0;animation:third-medal .66s cubic-bezier(.16,1.3,.3,1) .34s forwards}.third-flare{position:absolute;z-index:3;left:50%;top:35%;width:clamp(220px,48vw,390px);height:2px;background:linear-gradient(90deg,transparent,#fff0c4,#ed8244,transparent);transform:translate(-50%,-50%) scaleX(.2);opacity:0;animation:third-flare .53s ease-out .52s forwards}.third-ember{position:absolute;width:5px;aspect-ratio:1;border-radius:50%;background:#ffd199;box-shadow:0 0 12px #eb7133;opacity:0;animation:third-ember 1s ease-out forwards}.third-ember-a{left:30%;top:27%;--x:-46px;--y:-32px;animation-delay:.57s}.third-ember-b{left:70%;top:31%;--x:54px;--y:-44px;animation-delay:.62s}.third-ember-c{left:49%;top:26%;--x:4px;--y:-74px;animation-delay:.66s}.j3-third .j3-cinematic-copy{text-shadow:0 2px #4c200f,0 0 24px #d66a36}@keyframes third-podium{to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes third-medal{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}@keyframes third-flare{35%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scaleX(1)}}@keyframes third-ember{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--x),var(--y))}}",
".j3-fourth{background:radial-gradient(ellipse at 50% 41%,#155d54 0,#092b2b 49%,#020909 100%);color:#cdf9e8}.fourth-aura{position:absolute;left:50%;top:34%;width:min(480px,72vw);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%) scale(.55);opacity:0;background:radial-gradient(circle,#7ef3ce44,transparent 66%);animation:fourth-aura 1.1s ease-out .12s forwards}.fourth-rings{position:absolute;z-index:2;left:50%;top:35%;width:min(710px,106vw);transform:translate(-50%,-50%) scale(.7);fill:none;stroke:#9ffff038;stroke-width:2;opacity:0;animation:fourth-rings 1.25s cubic-bezier(.15,.8,.25,1) .14s forwards}.fourth-rings ellipse:nth-child(2){stroke:#aaffdf75}.fourth-rings ellipse:nth-child(3){stroke:#dcfff487}.fourth-mark{position:absolute;z-index:4;left:50%;top:35%;width:clamp(115px,19vw,160px);transform:translate(-50%,-50%) scale(.48);fill:#11554d;stroke:#bdffe9;stroke-width:4;opacity:0;filter:drop-shadow(0 0 22px #59e3bd88);animation:fourth-mark .7s cubic-bezier(.16,1.3,.3,1) .35s forwards}.fourth-number{position:absolute;z-index:5;left:50%;top:35%;color:#e6fff7;font-family:Arial,sans-serif;font-size:clamp(51px,9vw,78px);font-weight:900;text-shadow:0 0 20px #6ce6c1;transform:translate(-50%,-50%) scale(.5);opacity:0;animation:fourth-number .5s ease-out .58s forwards}.j3-fourth .j3-cinematic-copy{text-shadow:0 2px #073831,0 0 23px #55d9b2}@keyframes fourth-aura{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}@keyframes fourth-rings{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}@keyframes fourth-mark{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}@keyframes fourth-number{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}",
".j3-cup-champion{background:radial-gradient(ellipse at 50% 40%,#651d22 0,#26070e 49%,#060204 100%);color:#ffe7a4}.cup-drape{position:absolute;top:-10%;width:29%;height:116%;background:linear-gradient(90deg,#260209,#8f2330 50%,#37040c);box-shadow:inset -12px 0 25px #170106;opacity:0;animation:cup-drape .8s cubic-bezier(.16,1,.3,1) .04s forwards}.cup-drape-left{left:-2%;clip-path:polygon(0 0,100% 0,63% 100%,0 100%)}.cup-drape-right{right:-2%;clip-path:polygon(0 0,100% 0,100% 100%,37% 100%);transform:scaleX(-1)}.cup-halo{position:absolute;z-index:1;left:50%;top:35%;width:min(400px,65vw);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%) scale(.35);opacity:0;background:repeating-conic-gradient(#ffd77a 0 3deg,transparent 4deg 14deg);mask-image:radial-gradient(transparent 0 39%,#000 42% 74%,transparent 77%);animation:cup-halo 1s ease-out .22s forwards}.cup-trophy{position:absolute;z-index:4;left:50%;top:34%;width:clamp(120px,20vw,166px);transform:translate(-50%,-50%) translateY(-25px) scale(.55);fill:#a62029;stroke:#ffe5a0;stroke-width:5;stroke-linejoin:round;opacity:0;filter:drop-shadow(0 0 20px #f1ae35);animation:cup-trophy .72s cubic-bezier(.2,1.3,.3,1) .35s forwards}.cup-star{fill:#ffe7a1;stroke:none}.cup-crown{position:absolute;z-index:5;left:50%;top:13%;width:min(158px,28vw);transform:translateX(-50%) translateY(-30px);fill:#c93a36;stroke:#ffe6a0;stroke-width:4;opacity:0;filter:drop-shadow(0 0 15px #f5b840);animation:cup-crown .52s cubic-bezier(.16,1.35,.3,1) .78s forwards}.j3-cup-champion .j3-cinematic-copy{text-shadow:0 2px #4a060b,0 0 27px #f0aa34}@keyframes cup-drape{to{opacity:.9}}@keyframes cup-halo{to{opacity:.72;transform:translate(-50%,-50%) scale(1)}}@keyframes cup-trophy{to{opacity:1;transform:translate(-50%,-50%) translateY(0) scale(1)}}@keyframes cup-crown{to{opacity:1;transform:translateX(-50%) translateY(0)}}",
"@media(max-height:610px){.j3-cinematic-copy{bottom:5%}.j3-flavor{display:none}.first-crown,.cup-crown{top:7%}}@media (prefers-reduced-motion: reduce){.j3-stage *{animation:none!important;transition:none!important}.j3-cinematic-copy,.first-spot,.first-laurel,.first-crown,.first-medal,.second-wash,.second-spot,.second-ribbon,.second-medal,.third-podium,.third-medal,.fourth-aura,.fourth-rings,.fourth-mark,.fourth-number,.cup-drape,.cup-halo,.cup-trophy,.cup-crown{opacity:1!important}.j3-cinematic-copy{transform:translateX(-50%)!important}.first-laurel{stroke-dashoffset:0!important}.first-crown,.cup-crown{transform:translateX(-50%)!important}.first-medal,.second-medal,.third-medal,.fourth-mark,.fourth-number,.cup-halo{transform:translate(-50%,-50%) scale(1)!important}.third-podium{transform:translateX(-50%)!important}.cup-trophy{transform:translate(-50%,-50%) scale(1)!important}}"
].join("");
