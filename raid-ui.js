// Air raid screen: a radar scope over the real map around the city, and three tools against a raid in three waves:
// SAMs (tap a target), fire groups (drag them) and an EW jammer (hold it on a spike in the spectrum).
// It opens on a deploy phase (buy a kit, place the SAM site and the groups), then the fight, then a debrief.
// The simulation lives in game/raid.js; this file only draws it, plays it and turns taps into its inputs.
import { RAID, createRaid, polar, bearingOf, kitCost } from './game/raid.js';

// The look: a modern air-defence C2 screen. Graphite, a grey map, thin lines, military symbols (red diamond: hostile,
// blue frame: ours), data blocks by the tracks; colour only where it means something, orange for what we are doing.
const D2R = Math.PI / 180;
const C2 = { bg: '#0f1113', panel: '#14171a', rule: '#2a2f33', line: '#c9ced2', dim: '#7c858c', land: '#1f2428', sea: '#121518', border: '#3b444b', hos: '#ff5a4a', unk: '#e8c34a', fr: '#5aa9e6', act: '#ff8a1f' };
const HOS_RGB = '255,90,74', FR_RGB = '90,169,230', ACT_RGB = '255,138,31', LN_RGB = '201,206,210';
const RED = C2.hos, AMBER = C2.unk;
const F_LBL = '"Roboto Condensed","IBM Plex Sans Condensed","Arial Narrow",sans-serif', F_NUM = '"IBM Plex Mono",ui-monospace,Consolas,monospace';
const MHZ = f => Math.round(400 + f * 2100);
const KMH = 24.7;   // the sim runs fast: its speeds times this read as real km/h (a Shahed at ~185)
const tr = s => (window.slLang && window.slLang.tr ? window.slLang.tr(s) : s);
const fmtB = b => String(Math.round((b + 360) % 360)).padStart(3, '0') + '°';
const KIT_UI = {
  sam: { name: '+2 SAMs', text: 'Two more interceptors for the jets and the cruise salvo.', icon: 'M2 5h14v9H2zM5 12.5Q9 3 13 12.5' },
  group: { name: '+1 fire group', text: 'A fourth gun truck to cover another approach.', icon: 'M2 5h14v9H2zM2 14l7-6.5 7 6.5' },
  cells: { name: 'Jammer cells', text: 'The jammer battery lasts half as long again.', icon: 'M4 5h10v11H4zM7 3h4v2M7 9h4' },
  radar: { name: 'Fast radar', text: 'The beam sweeps faster: fresher fixes, easier SAM shots.', icon: 'M9 16A7 7 0 1 1 16 9M9 9l6-5' },
  lights: { name: 'Searchlights', text: 'At night the fire groups see almost as well as by day.', icon: 'M9 2v3M3 4l2 2.5M15 4l-2 2.5M5 10h8l1 6H4z' },
};
const MEDALS = { clear: 'Clear sky', sniper: 'No missile wasted', jammer: 'Master of the airwaves', lastline: 'Last line', salvo: 'Salvo', hunter: 'Hunter hunted' };
const TYPE_TXT = { shahed: 'strike drones', decoy: 'decoys', jet: 'jet drones', cruise: 'cruise missiles', hunter: 'hunter drone' };

const CSS = `
#raidOv{--bg:${C2.bg};--pn:${C2.panel};--ru:${C2.rule};--ln:${C2.line};--dm:${C2.dim};--hs:${C2.hos};--uk:${C2.unk};--fr:${C2.fr};--ac:${C2.act};--lbl:${F_LBL};--num:${F_NUM};
  position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:var(--bg);color:var(--ln);font:500 13px/1.4 var(--body,"Manrope",sans-serif);user-select:none;-webkit-user-select:none;touch-action:none;overflow:hidden}
#raidOv *{box-sizing:border-box}
#raidOv .rHead{display:flex;align-items:center;gap:18px;padding:0 16px;height:46px;flex:none;background:var(--pn);border-bottom:1px solid var(--ru)}
#raidOv .rAl{display:flex;align-items:center;gap:8px;font:700 13px/1 var(--lbl);letter-spacing:.08em;color:var(--hs)}
#raidOv .rAl i{width:14px;height:14px;background:var(--hs);animation:rBlink 1s steps(2) infinite}
@keyframes rBlink{50%{opacity:.25}}
#raidOv .rCity{font:700 18px/1 var(--lbl);letter-spacing:.02em;color:var(--ln)}
#raidOv .rWave{font:600 12.5px/1 var(--lbl);letter-spacing:.06em;padding:4px 9px;border:1px solid var(--ru);color:var(--ln)}
#raidOv .rSp{flex:1}
#raidOv .rScore{display:flex;align-items:baseline;gap:8px;font:600 11.5px/1 var(--lbl);letter-spacing:.06em;color:var(--dm)} #raidOv .rScore b{font:500 17px/1 var(--num);color:var(--ln);font-variant-numeric:tabular-nums;letter-spacing:0}
#raidOv .rCombo{font:500 14px/1 var(--num);color:var(--uk);opacity:0;transition:opacity .2s}
#raidOv .rCombo.on{opacity:1}
#raidOv .rStat{display:flex;gap:18px;font:600 11.5px/1 var(--lbl);letter-spacing:.06em;color:var(--dm);text-transform:uppercase} #raidOv .rStat b{font:500 15px/1 var(--num);color:var(--ln);margin-left:7px} #raidOv .rStat .bad b{color:var(--hs)}
#raidOv .rX{height:26px;padding:0 9px;border:1px solid var(--ru);background:transparent;color:var(--dm);font:600 11px/1 var(--lbl);letter-spacing:.08em;cursor:pointer}
#raidOv .rX:hover{color:var(--ln);border-color:var(--dm)}
#raidOv .rBody{flex:1;min-height:0;display:flex;position:relative}
#raidOv .rScopeW{flex:1;min-width:0;min-height:0;position:relative;overflow:hidden;border-right:1px solid var(--ru)}
#raidOv canvas{display:block}
#raidOv .rCalls{position:absolute;left:10px;top:34px;display:none;flex-direction:column;gap:3px;pointer-events:none;max-width:min(360px,72%)}
#raidOv .rCall,#raidOv .rLog>div{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:baseline;font-size:12px;line-height:1.3}
#raidOv .rCall{padding:4px 8px;background:rgba(15,17,19,.88);border-left:2px solid var(--dm);animation:rIn .2s both}
#raidOv .rCall i,#raidOv .rLog i{font:400 10.5px/1 var(--num);font-style:normal;color:var(--dm)}
#raidOv .rCall b,#raidOv .rLog b{font:600 12.5px/1.25 var(--lbl);letter-spacing:.03em;color:var(--ln)} #raidOv .rCall span,#raidOv .rLog span{font:400 11px/1.25 var(--num);color:var(--dm);margin-left:6px}
#raidOv .red b{color:var(--hs)} #raidOv .rCall.red{border-color:var(--hs)} #raidOv .amb b{color:var(--uk)} #raidOv .rCall.amb{border-color:var(--uk)} #raidOv .our b{color:var(--ac)} #raidOv .rCall.our{border-color:var(--ac)}
#raidOv .rCall.out{animation:rOut .4s both}
@keyframes rIn{0%{opacity:0;transform:translateY(-4px)}100%{opacity:1;transform:none}}
@keyframes rOut{100%{opacity:0}}
#raidOv .rBanner{position:absolute;left:50%;top:44px;transform:translateX(-50%);pointer-events:none;opacity:0;display:flex;align-items:stretch;background:rgba(15,17,19,.92);border:1px solid var(--ln)}
#raidOv .rBanner.on{animation:rBan 2.8s both}
#raidOv .rBanner b{display:flex;align-items:center;padding:8px 14px;font:700 22px/1 var(--lbl);letter-spacing:.06em;color:var(--bg);background:var(--hs);white-space:nowrap}
#raidOv .rBanner span{display:flex;align-items:center;padding:8px 14px;font:400 12.5px/1.3 var(--num);color:var(--ln);white-space:nowrap}
@keyframes rBan{0%{opacity:0;transform:translate(-50%,-6px)}8%{opacity:1;transform:translate(-50%,0)}85%{opacity:1}100%{opacity:0}}
#raidOv .rRange{position:absolute;left:10px;top:8px;height:22px;padding:0 8px;border:1px solid var(--ru);background:rgba(15,17,19,.85);color:var(--dm);font:400 11px/1 var(--num);cursor:pointer;z-index:2}
#raidOv .rRange:hover{color:var(--ln);border-color:var(--dm)}
#raidOv .rRange kbd{font:inherit;margin-left:6px;opacity:.7}
#raidOv .rTip{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);padding:6px 12px;background:rgba(15,17,19,.92);border:1px solid var(--dm);font:500 12.5px/1.3 var(--body,sans-serif);white-space:nowrap;pointer-events:none;transition:opacity .4s;opacity:0}
#raidOv .rSide{width:320px;flex:none;display:flex;flex-direction:column;min-height:0;overflow:auto;padding:0 16px 12px;background:var(--bg)}
#raidOv .rW{padding:12px 0 12px;border-bottom:1px solid var(--ru)}
#raidOv .rW h4{margin:0 0 9px;font:700 13px/1 var(--lbl);letter-spacing:.06em;display:flex;align-items:center;gap:8px;color:var(--ln)}
#raidOv .rW h4 em{font:400 11px/1 var(--num);font-style:normal;color:var(--dm);letter-spacing:0;margin-left:auto}
#raidOv .rW h4 kbd{order:3;font:600 10px/1 var(--lbl);letter-spacing:.08em;padding:3px 6px;border:1px solid var(--ru);color:var(--dm)}
#raidOv .rW small{display:block;margin-top:8px;font-size:11.5px;line-height:1.4;color:var(--dm)}
#raidOv .rAmmo{display:flex;gap:3px;align-items:center}
#raidOv .rAmmo i{flex:1;height:7px;background:var(--ln)} #raidOv .rAmmo i.u{background:var(--ru)}
#raidOv .rAmmo b{flex:none;margin-left:8px;font:500 13px/1 var(--num);color:var(--ln)}
#raidOv .rEng{display:flex;gap:8px;margin-top:8px;font:400 11.5px/1.2 var(--num);color:var(--dm);white-space:nowrap;overflow:hidden} #raidOv .rEng b{font:600 11px/1.2 var(--lbl);letter-spacing:.06em;color:var(--dm)} #raidOv .rEng.on span{color:var(--ac)}
#raidOv .rGrp{display:flex;flex-direction:column;gap:5px}
#raidOv .rGrp div{display:grid;grid-template-columns:34px 8px 1fr;gap:8px;align-items:center;font:600 12px/1 var(--lbl);letter-spacing:.04em;color:var(--dm)}
#raidOv .rGrp div b{font:500 12px/1 var(--num);color:var(--fr)} #raidOv .rGrp div i{width:6px;height:10px;background:var(--dm)}
#raidOv .rGrp .fire{color:var(--ac)} #raidOv .rGrp .fire i{background:var(--ac)} #raidOv .rGrp .mv{color:var(--fr)} #raidOv .rGrp .mv i{background:var(--fr)}
#raidOv .rGrp .hunted{color:var(--hs)} #raidOv .rGrp .hunted i{background:var(--hs);animation:rBlink .4s steps(2) infinite} #raidOv .rGrp .dead{color:#4a5157;text-decoration:line-through} #raidOv .rGrp .dead b{color:#4a5157} #raidOv .rGrp .dead i{background:#4a5157}
#raidOv .rBat{height:6px;background:var(--ru);overflow:hidden} #raidOv .rBat i{display:block;height:100%;background:var(--ln);transition:width .1s}
#raidOv .rBat.low i{background:var(--hs)} #raidOv .rBat.on i{background:var(--ac)}
#raidOv .rLogW{flex:1;min-height:120px;border-bottom:0}
#raidOv .rLog{display:flex;flex-direction:column;gap:6px}
#raidOv .rLog>div{animation:rIn .2s both} #raidOv .rLog>div:nth-child(n+8){display:none}
#raidOv .rTallyW{border-top:1px solid var(--ru);border-bottom:0;padding-bottom:0}
#raidOv .rTally{display:grid;grid-template-columns:repeat(4,auto);justify-content:space-between;gap:4px 12px;font:600 11px/1 var(--lbl);letter-spacing:.06em;color:var(--dm);text-transform:uppercase} #raidOv .rTally b{font:500 13px/1 var(--num);color:var(--ln);margin-left:5px} #raidOv .rTally .w b{color:var(--uk)}
#raidOv .rDep{display:none;flex-direction:column;gap:14px;padding-top:14px}
#raidOv .rCards{display:contents} #raidOv.deploy .rDep{display:flex} #raidOv.deploy .rCards{display:none}
#raidOv .rDep h3{margin:0;display:flex;align-items:baseline;gap:10px;font:700 20px/1 var(--lbl);letter-spacing:.04em;color:var(--ln)} #raidOv .rDep h3 span{font:400 11px/1 var(--num);color:var(--dm);letter-spacing:0}
#raidOv .rDep p{margin:0;font:500 12.5px/1.5 var(--body,sans-serif);color:#a9b0b5}
#raidOv .rIntel{display:flex;flex-direction:column;border-top:1px solid var(--ru)}
#raidOv .rIntel div{display:grid;grid-template-columns:14px 28px 1fr;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--ru);font-size:12.5px;color:#a9b0b5}
#raidOv .rIntel div b{font:500 13px/1 var(--num);color:var(--ln);text-align:right} #raidOv .rIntel svg{width:12px;height:12px}
#raidOv .rBud{display:flex;align-items:center;gap:3px;font:700 12px/1 var(--lbl);letter-spacing:.06em;color:var(--ln)} #raidOv .rBud>span:first-child{margin-right:8px}
#raidOv .rBud i{flex:1;height:8px;background:var(--ac)} #raidOv .rBud i.u{background:var(--ru)} #raidOv .rBud .notr{margin-left:8px;font:500 13px/1 var(--num)}
#raidOv .rKit{display:flex;flex-direction:column;border-top:1px solid var(--ru)}
#raidOv .rK{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;padding:9px 6px 9px 4px;border:0;border-bottom:1px solid var(--ru);border-left:2px solid transparent;background:transparent;cursor:pointer;text-align:left;color:inherit;font:inherit}
#raidOv .rK:hover:not(:disabled){background:rgba(${LN_RGB},.04)}
#raidOv .rK.on{border-left-color:var(--ac);background:rgba(${ACT_RGB},.06)}
#raidOv .rK:disabled{opacity:.35;cursor:default}
#raidOv .rK svg{width:18px;height:18px;fill:none;stroke:var(--dm);stroke-width:1.4;stroke-linejoin:round}
#raidOv .rK.on svg{stroke:var(--ac)}
#raidOv .rK b{display:block;font:700 13px/1.15 var(--lbl);letter-spacing:.03em;color:var(--ln);margin-bottom:3px} #raidOv .rK b .notr{font:400 11px/1 var(--num);color:var(--dm);margin-left:4px} #raidOv .rK small{display:block;font-size:11.5px;line-height:1.35;color:var(--dm)}
#raidOv .rK .c{font:500 13px/1 var(--num);color:var(--dm);white-space:nowrap} #raidOv .rK.on .c{color:var(--ac)}
#raidOv .rGo{width:100%;height:46px;border:0;background:var(--ac);color:#111;font:700 15px/1 var(--lbl);letter-spacing:.1em;cursor:pointer}
#raidOv .rGo:hover{filter:brightness(1.08)} #raidOv .rGo:focus-visible,#raidOv .rK:focus-visible,#raidOv .rX:focus-visible,#raidOv .rRange:focus-visible{outline:1px solid var(--ln);outline-offset:2px}
#raidOv .rDep .rGo{position:sticky;bottom:0;flex:none;box-shadow:0 -14px 18px var(--bg)}
#raidOv .rGo.sec{background:transparent;border:1px solid var(--dm);color:var(--ln)}
#raidOv .rSpec{flex:none;position:relative;border-top:1px solid var(--ru)} #raidOv .rSpecIn{position:relative;overflow:hidden;background:var(--bg);cursor:ew-resize}
#raidOv .rSpecL{position:absolute;left:10px;top:7px;display:flex;gap:12px;font:600 11px/1 var(--lbl);letter-spacing:.06em;color:var(--dm);pointer-events:none} #raidOv .rSpecL span{font:400 11px/1 var(--num);color:var(--ln);letter-spacing:0}
#raidOv.deploy .rSpecIn{opacity:.4;pointer-events:none}
#raidOv .rCard{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,12,13,.86);z-index:5;padding:16px;overflow:auto}
#raidOv .rCard[hidden]{display:none}
#raidOv .rBox{width:min(680px,100%);border:1px solid var(--dm);padding:0;background:var(--pn);animation:rIn .3s both}
#raidOv .rBox .rKh{display:flex;justify-content:space-between;padding:10px 18px;border-bottom:1px solid var(--ru);font:700 12px/1 var(--lbl);letter-spacing:.1em;color:var(--dm)} #raidOv .rBox .rKh span{font:400 11px/1 var(--num);letter-spacing:0}
#raidOv .rRes{display:flex;gap:20px;align-items:center;padding:18px}
#raidOv .rGrade{width:96px;height:96px;display:flex;align-items:center;justify-content:center;font:700 60px/1 var(--lbl);flex:none;border:1px solid currentColor}
#raidOv .rBox h2{margin:0;font:700 26px/1.1 var(--lbl);letter-spacing:.01em;color:var(--ln);text-wrap:balance}
#raidOv .rBox p{margin:6px 0 0;color:#a9b0b5;font:500 13.5px/1.5 var(--body,sans-serif)}
#raidOv .rPts{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:10px;font:500 30px/1 var(--num);color:var(--ln);font-variant-numeric:tabular-nums} #raidOv .rPts small{font:600 11.5px/1 var(--lbl);letter-spacing:.08em;color:var(--dm)}
#raidOv .rRec{padding:4px 7px;background:var(--ac);color:#111;font:700 10.5px/1 var(--lbl);letter-spacing:.1em;align-self:center}
#raidOv .rNums{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--ru);border-bottom:1px solid var(--ru)}
#raidOv .rNums div{padding:12px 18px;border-left:1px solid var(--ru)} #raidOv .rNums div:first-child{border-left:0}
#raidOv .rNums b{display:block;font:500 24px/1 var(--num);color:var(--ln);margin-bottom:6px} #raidOv .rNums span{font:600 11px/1.3 var(--lbl);letter-spacing:.05em;color:var(--dm);text-transform:uppercase}
#raidOv .rMedals{display:flex;flex-wrap:wrap;gap:6px;padding:14px 18px 0}
#raidOv .rMedals span{padding:5px 9px;border:1px solid var(--uk);color:var(--uk);font:700 11.5px/1 var(--lbl);letter-spacing:.05em;animation:rIn .3s both}
#raidOv .rNotes{padding:4px 18px 0}
#raidOv .rBtns{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:16px 18px 18px}
#raidOv .shake{animation:rShake .35s}
@keyframes rShake{25%{transform:translate(5px,-3px)}50%{transform:translate(-4px,3px)}75%{transform:translate(2px,1px)}}
#raidOv .rFlash{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 3px var(--hs),inset 0 0 120px rgba(${HOS_RGB},.25);opacity:0;transition:opacity .5s;z-index:2}
@media (prefers-reduced-motion:reduce){#raidOv .shake{animation:none} #raidOv .rAl i{animation:none}}
@media (max-width:760px){
  #raidOv .rHead{padding:6px 10px;gap:4px 12px;height:auto;flex-wrap:wrap} #raidOv .rCity{font-size:15px} #raidOv .rAl{font-size:11px} #raidOv .rAl span{display:none} #raidOv .rWave{font-size:11px;padding:3px 6px}
  #raidOv .rStat{gap:12px;font-size:10px;width:100%;order:5} #raidOv .rStat b{font-size:13px;margin-left:5px} #raidOv .rScore{margin-left:auto} #raidOv .rScore b{font-size:15px} #raidOv .rScore>span:first-child{display:none} #raidOv .rSp{display:none} #raidOv .rX{order:4}
  #raidOv .rBody{flex-direction:column;flex:none} #raidOv .rScopeW{flex:none;border-right:0;border-bottom:1px solid var(--ru)}
  #raidOv .rCalls{display:flex;flex-direction:column-reverse;top:auto;bottom:8px;left:6px} #raidOv .rCall{font-size:11px;padding:3px 7px} #raidOv .rCall:nth-child(n+4){display:none} #raidOv .rTip{bottom:auto;top:84px;white-space:normal;width:max-content;max-width:calc(100% - 20px);text-align:center}
  #raidOv .rSide{width:auto;flex:none;overflow:visible;padding:0 10px} #raidOv.deploy .rBody{flex:1;min-height:0} #raidOv.deploy .rSide{flex:1;overflow:auto}
  #raidOv .rCards{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:12px} #raidOv .rW{padding:7px 0;border:0} #raidOv .rW small,#raidOv .rLogW,#raidOv .rTallyW,#raidOv .rW h4 em,#raidOv .rW h4 kbd,#raidOv .rEng{display:none}
  #raidOv .rW h4{font-size:11px;margin-bottom:6px} #raidOv .rAmmo i{height:6px} #raidOv .rAmmo b{font-size:11px;margin-left:4px}
  #raidOv .rGrp{flex-direction:row;gap:4px} #raidOv .rGrp div{display:flex;flex-direction:column;gap:3px;flex:1;font-size:0} #raidOv .rGrp div i{width:100%;height:6px} #raidOv .rGrp div b{font-size:10px}
  #raidOv .rBat{margin-top:4px}
  #raidOv .rSpecL{top:5px;left:6px}
  #raidOv .rDep{padding-top:10px;gap:10px} #raidOv .rDep h3{font-size:17px} #raidOv .rDep p{font-size:12px} #raidOv .rIntel{display:grid;grid-template-columns:1fr 1fr;column-gap:12px} #raidOv .rIntel div{padding:5px 0}
  #raidOv .rK{grid-template-columns:20px 1fr auto;padding:8px 4px} #raidOv .rK small{display:none} #raidOv.deploy .rSpec{display:none}
  #raidOv .rBanner{top:36px} #raidOv .rBanner b{font-size:16px;padding:6px 10px} #raidOv .rBanner span{font-size:11px;padding:6px 10px;white-space:normal;max-width:52vw}
  #raidOv .rRes{padding:14px;gap:14px} #raidOv .rBox h2{font-size:20px} #raidOv .rGrade{width:68px;height:68px;font-size:42px} #raidOv .rNums{grid-template-columns:repeat(2,1fr)} #raidOv .rNums div:nth-child(3){border-left:0} #raidOv .rNums div:nth-child(n+3){border-top:1px solid var(--ru)} #raidOv .rNums div{padding:10px 14px} #raidOv .rPts{font-size:24px}
  #raidOv .rMedals,#raidOv .rNotes{padding-left:14px;padding-right:14px} #raidOv .rBtns{padding:14px}
}`;

// opts: { lat, lng, city, polys, cities: [{ name, lat, lng, own }], params: { seed, bearings, size, night, sams, groups, battery, budget }, muted(), onEnd(result, log), onAgain(), onClose(), deployTime (s, optional) }
export function openRaid(opts) {
  if (!document.getElementById('raidCss')) { const st = document.createElement('style'); st.id = 'raidCss'; st.textContent = CSS; document.head.appendChild(st); }
  const raid = createRaid(opts.params), S = raid.S, P = raid.P, plan = raid.plan;
  const ov = document.createElement('div'); ov.id = 'raidOv'; ov.className = 'deploy';
  const count = t => plan.targets.filter(x => x.type === t).length;
  const B = P.bearings && P.bearings.length ? P.bearings : [0], bMin = Math.min(...B), bMax = Math.max(...B);
  ov.innerHTML = `
  <div class="rHead"><div class="rAl"><i></i><span>AIR RAID ALERT</span></div><div class="rCity">${opts.city}</div><div class="rWave" id="rWave">DEPLOY</div><div class="rSp"></div>
    <div class="rScore"><span>SCORE</span><b class="notr" id="rPts">0</b><span class="rCombo notr" id="rCombo"></span></div>
    <div class="rStat"><span>In the air<b id="rsAir">0</b></span><span>Shot down<b id="rsDown">0</b></span><span class="bad">Got through<b id="rsLeak">0</b></span></div>
    <button class="rX" id="rX" title="Leave">EXIT</button></div>
  <div class="rBody"><div class="rScopeW" id="rScopeW"><canvas id="rScope"></canvas><div class="rCalls" id="rCalls"></div><div class="rBanner" id="rBanner"></div><button class="rRange notr" id="rRange"></button><div class="rTip" id="rTip"></div></div>
    <div class="rSide">
      <div class="rDep" id="rDep">
        <h3>DEPLOY<span class="notr">${fmtB(bMin)}${bMax !== bMin ? '–' + fmtB(bMax) : ''}</span></h3>
        <p>Intel: a raid from ${fmtB(bMin)}${bMax !== bMin ? '–' + fmtB(bMax) : ''}, three waves. Drag the SAM site (the frame with an arc) and the fire groups (the frames with a chevron) on the map, then buy what you need.</p>
        <div class="rIntel">${['shahed', 'decoy', 'jet', 'hunter', 'cruise'].map(t => count(t) ? `<div><svg viewBox="0 0 12 12"><path d="M6 1l5 5-5 5-5-5z" fill="rgba(${HOS_RGB},.2)" stroke="${C2.hos}"/></svg><b>${count(t)}</b><span>${TYPE_TXT[t]}</span></div>` : '').join('')}${P.night ? '<div><svg viewBox="0 0 12 12"><path d="M8 1a5 5 0 1 0 3 8A4 4 0 0 1 8 1z" fill="none" stroke="#7c858c"/></svg><b></b><span>night: fire groups see less</span></div>' : ''}</div>
        <div class="rBud"><span>BUDGET</span><span id="rBud" style="display:contents"></span></div>
        <div class="rKit" id="rKit"></div>
        <button class="rGo" id="rGo"><span>START THE FIGHT</span><span class="notr rGoT" id="rGoT"></span></button>
      </div>
      <div class="rCards">
        <div class="rW sam"><h4>SAM <kbd>TAP</kbd><em class="notr">${RAID.SAM_RANGE} ${tr('km')}</em></h4><div class="rAmmo" id="rAmmo"></div><div class="rEng" id="rEng"></div><small>Tap a target on the radar to launch. Only inside the dashed circle of the site.</small></div>
        <div class="rW gun"><h4>FIRE GROUPS <kbd>DRAG</kbd></h4><div class="rGrp" id="rGrp"></div><small>Drag a group onto an approach. Guns cut down slow drones in their circle. Watch for the hunter.</small></div>
        <div class="rW ew"><h4>EW JAMMER <kbd>HOLD</kbd><em class="notr" id="rEwF"></em></h4><div class="rBat" id="rBat"><i></i></div><small>Hold the band on a spike below. A cut link brings its drones down; the bearing shows which blips are real.</small></div>
        <div class="rW rLogW"><h4>LOG</h4><div class="rLog" id="rLog"></div></div>
        <div class="rW rTallyW"><div class="rTally" id="rTally"></div></div>
      </div>
    </div></div>
  <div class="rSpec"><div class="rSpecIn" id="rSpecIn"><canvas id="rSpecC"></canvas><div class="rSpecL">SPECTRUM<span class="notr" id="rFreq"></span></div></div></div>
  <div class="rFlash" id="rFlash"></div>
  <div class="rCard" id="rEnd" hidden></div>`;
  document.body.appendChild(ov);
  const $ = id => ov.querySelector('#' + id);
  const scope = $('rScope'), sctx = scope.getContext('2d'), spec = $('rSpecC'), pctx = spec.getContext('2d');
  const wf = document.createElement('canvas'), wctx = wf.getContext('2d');

  // ---------- sound: synthesized cues, nothing to download ----------
  let ac = null, staticNode = null, staticGain = null;
  const audio = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; } return ac; };
  const muted = () => !!(opts.muted && opts.muted());
  function beep(f, d, type = 'sine', vol = 0.05, slide = 0, at = 0) {
    if (!ac || muted()) return; const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, vol, from, to, at = 0) {
    if (!ac || muted()) return; const t = ac.currentTime + at, n = Math.ceil(ac.sampleRate * d), b = ac.createBuffer(1, n, ac.sampleRate), x = b.getChannelData(0);
    for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.value = vol; s.connect(f).connect(g).connect(ac.destination); s.start(t);
  }
  function staticOn(on, level) {
    if (!ac || muted()) { if (staticGain) staticGain.gain.value = 0; return; }
    if (!staticNode) { const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), x = b.getChannelData(0); for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
      staticNode = ac.createBufferSource(); staticNode.buffer = b; staticNode.loop = true; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; staticGain = ac.createGain(); staticGain.gain.value = 0; staticNode.connect(f).connect(staticGain).connect(ac.destination); staticNode.start(); }
    staticGain.gain.setTargetAtTime(on ? 0.02 + 0.07 * level : 0, ac.currentTime, 0.05);
  }
  const siren = () => { for (let k = 0; k < 2; k++) { beep(380, 0.9, 'sawtooth', 0.035, 420, k * 0.95); beep(382, 0.9, 'square', 0.012, 420, k * 0.95); } };
  const buzz = ms => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) {} };   // only after a real tap

  // ---------- the map around the city, as an azimuthal equidistant projection ----------
  const lat0 = opts.lat * D2R, lng0 = opts.lng * D2R;
  const proj = (lat, lng) => {   // → [x east km, y north km]
    const la = lat * D2R, lo = lng * D2R, c = Math.acos(Math.max(-1, Math.min(1, Math.sin(lat0) * Math.sin(la) + Math.cos(lat0) * Math.cos(la) * Math.cos(lo - lng0))));
    if (c < 1e-9) return [0, 0];
    const k = c / Math.sin(c) * 6371;
    return [k * Math.cos(la) * Math.sin(lo - lng0), k * (Math.cos(lat0) * Math.sin(la) - Math.sin(lat0) * Math.cos(la) * Math.cos(lo - lng0))];
  };
  // whole rings near the city, projected once: land is filled (lakes cut out), every ring edge is a coast or a border
  const land = [], lakes = [];
  for (const p of opts.polys || []) for (const ring of p[1] || []) {
    let near = false; const pts = [];
    for (let k = 0; k + 1 < ring.length; k += 2) { const q = proj(ring[k + 1], ring[k]); pts.push(q); if (!near && Math.hypot(q[0], q[1]) < RAID.R * 1.8) near = true; }
    if (near && pts.length > 2) (p[0] ? lakes : land).push(pts);
  }
  const towns = (opts.cities || []).map(c => ({ ...c, p: proj(c.lat, c.lng) })).filter(c => Math.hypot(c.p[0], c.p[1]) < RAID.R * 0.97 && Math.hypot(c.p[0], c.p[1]) > 20);
  // the city itself: a cluster of lights that go dark where the raid gets through
  const lights = []; { let s = 1234567; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let k = 0; k < 90; k++) { const a = rnd() * 7, r = Math.sqrt(rnd()) * 15; lights.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, on: true, w: 0.6 + rnd() * 0.8 }); } }
  const fires = [];

  // ---------- layout and zoom ----------
  // the map is a rectangle that fills its panel; the radar's reach is a ring centred on the city
  let W = 0, H = 0, cx = 0, cy = 0, sc = 1, SW = 0, SH = 0, dpr = 1, VR = 210;   // the deploy happens close to the city, so it starts zoomed in; desktops zoom out when the fight starts
  const mapCv = document.createElement('canvas'), mctx = mapCv.getContext('2d'); let mapKey = '';
  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const phone = innerWidth <= 760, wrap = $('rScopeW');
    if (phone) { wrap.style.height = Math.max(220, Math.floor(Math.min(innerWidth * 1.02, innerHeight * 0.5))) + 'px'; }
    else wrap.style.height = '';
    const sb0 = $('rSpecIn'); if (!phone) { SH = Math.max(120, Math.min(200, Math.round(innerHeight * 0.22))); }
    else SH = Math.max(110, Math.min(420, Math.floor(innerHeight - sb0.getBoundingClientRect().top - 4)));   // on phones the spectrum takes what is left: a finger needs room
    spec.style.height = SH + 'px';
    const box = wrap.getBoundingClientRect();
    W = Math.max(200, Math.floor(box.width)); H = Math.max(200, Math.floor(box.height));
    scope.width = W * dpr; scope.height = H * dpr; scope.style.width = W + 'px'; scope.style.height = H + 'px';
    cx = W / 2; cy = H / 2; sc = (Math.min(W, H) / 2 - 18) / VR;
    const sb = sb0.getBoundingClientRect(); SW = Math.max(100, Math.floor(sb.width));
    spec.width = SW * dpr; spec.height = SH * dpr; spec.style.width = SW + 'px'; spec.style.height = SH + 'px';
    const old = wf.width && wf.height ? wctx.getImageData(0, 0, wf.width, wf.height) : null; wf.width = SW; wf.height = Math.max(20, SH - Math.round(SH * 0.4)); if (old) wctx.putImageData(old, 0, 0);
  }
  const setRange = r => { VR = r; sc = (Math.min(W, H) / 2 - 18) / VR; $('rRange').innerHTML = `${tr('RANGE')} ${VR === RAID.R ? 400 : 200} ${tr("km")}<kbd>[Z]</kbd>`; };
  const ro = new ResizeObserver(() => { layout(); setRange(VR); }); ro.observe(ov);
  layout(); setRange(VR);
  $('rRange').onclick = () => setRange(VR === RAID.R ? 210 : RAID.R);
  const toPx = (x, y) => [cx + x * sc, cy - y * sc], toKm = (px, py) => [(px - cx) / sc, (cy - py) / sc];

  // ---------- deploy: the kit shop ----------
  const kit = { sam: 0, group: 0, cells: 0, radar: 0, lights: 0 };
  function renderKit() {
    const spent = kitCost(kit), left = P.budget - spent;
    $('rBud').innerHTML = Array.from({ length: P.budget }, (_, k) => `<i class="${k < left ? '' : 'u'}"></i>`).join('') + ` <span class="notr">${left}/${P.budget}</span>`;
    $('rKit').innerHTML = Object.entries(RAID.KIT).map(([k, c]) => {
      if (k === 'lights' && !P.night) return '';
      const n = kit[k], u = KIT_UI[k], can = n < c.max && c.cost <= left;
      return `<button class="rK${n ? ' on' : ''}" data-k="${k}"${!can && !n ? ' disabled' : ''}><svg viewBox="0 0 18 18"><path d="${u.icon}"/></svg><span><b>${u.name}${c.max > 1 ? ` <span class="notr">${n}/${c.max}</span>` : ''}</b><small>${u.text}</small></span><span class="c notr">${n ? (c.max > 1 && can ? '+' : '−') : '+'}${c.cost}</span></button>`;
    }).join('');
  }
  $('rKit').onclick = e => {
    const b = e.target.closest('[data-k]'); if (!b || b.disabled) return; audio();
    const k = b.dataset.k, c = RAID.KIT[k], left = P.budget - kitCost(kit);
    if (kit[k] < c.max && c.cost <= left) kit[k]++; else kit[k] = 0;
    raid.input({ a: 'kit', kit: { ...kit } }); raid.deployNow(); renderKit(); beep(kit[k] ? 660 : 330, 0.08, 'triangle', 0.04);
  };
  renderKit();

  // ---------- input ----------
  let drag = null, jamming = false, tipT = 0, started = false, ended = false;
  const tip = (s, keep = 3.5) => { $('rTip').textContent = tr(s); $('rTip').style.opacity = 1; tipT = performance.now() + keep * 1000; };
  const hitR = innerWidth <= 760 ? 36 : 26;
  scope.addEventListener('pointerdown', e => {
    if (ended) return; audio();
    const r = scope.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (!started) { const [sx, sy] = toPx(S.site[0], S.site[1]); if (Math.hypot(sx - px, sy - py) < hitR) { drag = { site: true, px, py }; try { scope.setPointerCapture(e.pointerId); } catch (err) {} return; } }
    const g = S.groups.find(g => { if (g.dead) return false; const [gx, gy] = toPx(g.x, g.y); return Math.hypot(gx - px, gy - py) < hitR; });
    if (g) { drag = { g: g.id, px, py }; try { scope.setPointerCapture(e.pointerId); } catch (err) {} return; }
    if (!started) return;
    let best = null, bd = hitR + 6;
    for (const m of S.targets) { if (!raid.tracked(m) || !m.paints.length) continue; const p = m.paints[m.paints.length - 1], [bx, by] = toPx(p[0], p[1]), d = Math.hypot(bx - px, by - py); if (d < bd) { bd = d; best = m; } }
    if (!best) return;
    if (S.sams <= 0) { tip('No SAMs left: guns and the jammer only'); beep(180, 0.15, 'square', 0.03); }
    else if (S.missiles.some(s => s.id === best.id && !s.done)) tip('A missile is already on its way to that target');
    else if (!raid.inSamRange(best)) { tip('Out of SAM range: wait until it is inside the dashed circle'); beep(220, 0.12, 'square', 0.03); }
    else raid.input({ a: 'fire', id: best.id });
  });
  scope.addEventListener('pointermove', e => { if (!drag) return; const r = scope.getBoundingClientRect(); drag.px = e.clientX - r.left; drag.py = e.clientY - r.top; });
  const drop = () => {
    if (!drag) return; const [x, y] = toKm(drag.px, drag.py);
    if (!started) { raid.input(drag.site ? { a: 'place', what: 'site', x: Math.round(x), y: Math.round(y) } : { a: 'place', g: drag.g, x: Math.round(x), y: Math.round(y) }); raid.deployNow(); }
    else raid.input({ a: 'move', g: drag.g, x: Math.round(x), y: Math.round(y) });
    drag = null; beep(520, 0.06, 'triangle', 0.03);
  };
  scope.addEventListener('pointerup', drop); scope.addEventListener('pointercancel', drop);
  const specIn = $('rSpecIn'); let lastF = -1;
  const jamAt = (e, on) => { const r = specIn.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); if (on !== jamming || Math.abs(f - lastF) > 0.002) { jamming = on; lastF = f; raid.input({ a: 'jam', on, f: +f.toFixed(3) }); } };
  specIn.addEventListener('pointerdown', e => { if (!started || ended) return; audio(); try { specIn.setPointerCapture(e.pointerId); } catch (err) {} jamAt(e, true); });
  specIn.addEventListener('pointermove', e => { if (jamming) jamAt(e, true); });
  const unjam = () => { if (jamming) { jamming = false; raid.input({ a: 'jam', on: false }); } };
  specIn.addEventListener('pointerup', unjam); specIn.addEventListener('pointercancel', unjam);
  const onKey = e => {
    if (e.code === 'KeyZ' && e.type === 'keydown') setRange(VR === RAID.R ? 210 : RAID.R);
    if (started && !ended) {
      if (e.code === 'Space') { e.preventDefault(); if (e.type === 'keydown' && !jamming) { jamming = true; raid.input({ a: 'jam', on: true, f: S.jam.f }); } if (e.type === 'keyup') unjam(); }
      if (e.type === 'keydown' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD')) { e.preventDefault(); const f = Math.max(0, Math.min(1, S.jam.f + (e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 1) * (e.shiftKey ? 0.04 : 0.012))); raid.input({ a: 'jam', on: jamming, f: +f.toFixed(3) }); }
    }
    e.stopPropagation();
  };
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
  // in the war the enemy will not wait: deployTime seconds to set up, then the fight starts by itself
  let deployT = null;
  if (opts.deployTime) { const end = performance.now() + opts.deployTime * 1000; const tickDeploy = () => { if (started) return clearInterval(deployT); const left = Math.max(0, Math.ceil((end - performance.now()) / 1000)); $('rGoT').textContent = ' · 0:' + String(left).padStart(2, '0'); if (!left) $('rGo').click(); }; deployT = setInterval(tickDeploy, 250); tickDeploy(); }
  $('rGo').onclick = () => { if (started) return; clearInterval(deployT); $('rGoT').textContent = ''; audio(); ov.classList.remove('deploy'); started = true; siren(); layout(); setRange(innerWidth > 760 ? RAID.R : VR); };
  $('rX').onclick = () => close();

  // ---------- callouts, banner, popups, particles ----------
  const calls = [];
  function call(label, data, cls = '') {
    const tt = Math.max(0, Math.floor(S.t)), stamp = `T+${String(Math.floor(tt / 60)).padStart(2, '0')}:${String(tt % 60).padStart(2, '0')}`;
    const html = `<i class="notr">${stamp}</i><div><b>${label}</b>${data ? `<span class="notr">${data}</span>` : ''}</div>`;
    const d = document.createElement('div'); d.className = 'rCall ' + cls; d.innerHTML = html;
    $('rCalls').prepend(d); calls.push({ d, t: performance.now() });
    while ($('rCalls').children.length > 4) $('rCalls').lastChild.remove();
    const e = document.createElement('div'); e.className = cls; e.innerHTML = html; $('rLog').prepend(e);   // the desktop log keeps them
    while ($('rLog').children.length > 12) $('rLog').lastChild.remove();
  }
  function banner(title, sub) { const b = $('rBanner'); b.innerHTML = `<b>${title}</b><span>${sub}</span>`; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
  const popups = [], parts = [];
  const pop = (x, y, text, color, big = false) => popups.push({ x, y, text, color, big, t: performance.now() });
  const burst = (x, y, n, color, speed, life, size = 1.6, kind = 'spark') => { for (let k = 0; k < n; k++) { const a = Math.random() * 7, v = speed * (0.3 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: size * (0.6 + Math.random() * 0.8), kind }); } };
  const smoke = (x, y, n = 1, life = 1.2) => { for (let k = 0; k < n; k++) parts.push({ x: x + (Math.random() - 0.5) * 2, y: y + (Math.random() - 0.5) * 2, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life, max: life, color: '170,180,170', size: 2.5, kind: 'smoke' }); };
  let contacts = [], contactT = 0, flashT = 0, fxSeen = 0, comboT = 0;
  const LINK = l => String.fromCharCode(65 + l);
  function onFx(f) {
    switch (f.k) {
      case 'wave': {
        const w = S.waves[f.wave], ty = {}; for (const m of [...S.pending, ...S.targets]) if (m.wave === f.wave) ty[m.type] = (ty[m.type] || 0) + 1;
        banner(`${tr('WAVE')} ${f.wave + 1}/${S.waves.length}`, Object.entries(ty).map(([t, n]) => `${n} ${tr(TYPE_TXT[t])}`).join(' · '));
        $('rWave').textContent = `${tr('WAVE')} ${f.wave + 1}/${S.waves.length}`; siren(); buzz(80);
        if (f.wave === 2) call('FINAL WAVE', '', 'red'); break;
      }
      case 'contact': contacts.push(f); if (!contactT) contactT = performance.now(); break;
      case 'launch': burst(f.x, f.y, 8, '255,220,160', 9, 0.4, 1.4); smoke(f.x, f.y, 6, 1.6); noise(0.7, 0.2, 3500, 250); buzz(15); break;
      case 'kill': {
        const big = f.type === 'cruise' || f.type === 'jet';
        burst(f.x, f.y, big ? 22 : 14, f.how === 'ew' ? '200,210,200' : '255,200,120', big ? 30 : 20, 0.9, big ? 2.2 : 1.7);
        burst(f.x, f.y, 5, '255,120,60', 6, 1.6, 2.6, 'debris'); smoke(f.x, f.y, 4, 2);
        if (f.pts) pop(f.x, f.y, (f.pts > 0 ? '+' : '') + f.pts + (f.chain >= 2 ? ` ×${(1 + 0.25 * (f.chain - 1)).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}` : ''), f.pts > 0 ? '#fff3c8' : RED, f.chain >= 3);
        if (f.type === 'decoy' && f.how === 'sam') call('DECOY', '−' + RAID.DECOY_PTS, 'amb');
        if (f.type === 'hunter') call('HUNTER DOWN', '', 'our');
        if (f.chain >= 3) { call('STREAK', '×' + f.chain, 'amb'); comboT = performance.now(); }
        noise(0.6, big ? 0.4 : 0.25, 1200, 60); beep(220 + 40 * Math.min(8, f.chain), 0.18, 'triangle', 0.04, 120); buzz(big ? 40 : 20); break;
      }
      case 'leak': {
        flashT = performance.now(); burst(0, 0, 30, '255,120,80', 28, 1.2, 2.6); smoke(0, 0, 10, 2.6);
        for (const l of lights) if (l.on && Math.random() < 0.16) l.on = false;
        fires.push({ x: (Math.random() - 0.5) * 18, y: (Math.random() - 0.5) * 18, t: performance.now() });
        pop(0, 0, '−' + RAID.LEAK_PTS, RED, true); call('IMPACT', tr('the city is hit'), 'red');
        noise(1.4, 0.6, 700, 35); beep(70, 0.9, 'sine', 0.16, -30); buzz([70, 40, 120]);
        const body = ov.querySelector('.rBody'); body.classList.remove('shake'); void body.offsetWidth; body.classList.add('shake'); break;
      }
      case 'dud': smoke(f.x, f.y, 5, 1.6); call('DECOY', tr('fell on the city, no warhead'), ''); break;
      case 'jam': beep(1500, 0.25, 'square', 0.015, -1100); break;
      case 'linkCut': call(`LINK ${LINK(f.link)} CUT`, `${f.n} ↓`, 'our'); beep(900, 0.2, 'sawtooth', 0.03, -700); break;
      case 'crash': burst(f.x, f.y, 6, '190,200,190', 8, 0.8, 1.4); smoke(f.x, f.y, 3, 1.8); break;
      case 'groupLost': flashT = performance.now(); burst(f.x, f.y, 26, '255,194,61', 22, 1.1, 2.4); smoke(f.x, f.y, 8, 2.4); call(`FIRE GROUP ${f.g + 1} LOST`, '', 'red'); noise(1, 0.45, 900, 50); buzz([60, 40, 60]); break;
      case 'miss': call('MISS', '', 'amb'); beep(240, 0.2, 'square', 0.03, -80); break;
      case 'flat': call('JAMMER FLAT', tr('let it recharge'), 'amb'); break;
    }
  }
  function flushContacts() {
    if (!contacts.length || performance.now() - contactT < 600) return;
    const by = {}; for (const c of contacts) (by[c.type === 'cruise' || c.type === 'hunter' ? c.type : 'other'] = by[c.type === 'cruise' || c.type === 'hunter' ? c.type : 'other'] || []).push(c);
    const where = list => { let sx = 0, sy = 0, d = 0; for (const c of list) { sx += c.x; sy += c.y; d += Math.hypot(c.x, c.y); } return `${fmtB(bearingOf(sx, sy))} · ${Math.round(d / list.length)} ${tr("km")}`; };
    if (by.cruise) { call('CRUISE MISSILE', `${by.cruise.length > 1 ? by.cruise.length + ' · ' : ''}${where(by.cruise)}`, 'red'); beep(1200, 0.12, 'square', 0.04); beep(1200, 0.12, 'square', 0.04, 0, 0.18); }
    if (by.hunter) { call('HUNTER DRONE', where(by.hunter), 'amb'); beep(1600, 0.1, 'square', 0.03); }
    if (by.other) call('NEW CONTACTS', `${by.other.length} · ${where(by.other)}`, '');
    contacts = []; contactT = 0;
  }

  // ---------- drawing ----------
  const glowDot = (c, x, y, r, color, a = 1) => { const g = c.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, color); g.addColorStop(0.3, color); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3, 0, 7); c.fill(); c.globalAlpha = 1; };
  const ringPath = (c, pts) => { pts.forEach(([x, y], k) => { const px = cx + x * sc, py = cy - y * sc; k ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); };
  // the static map (sea, land with a little texture, borders, km grid, range rings, towns), redrawn only when the view changes
  function drawMap() {
    const key = [W, H, dpr, VR].join(); if (key === mapKey) return; mapKey = key;
    mapCv.width = W * dpr; mapCv.height = H * dpr; const c = mctx, phone = innerWidth <= 760;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = C2.sea; c.fillRect(0, 0, W, H);
    c.beginPath(); for (const r of land) ringPath(c, r); c.fillStyle = C2.land; c.fill('evenodd');
    c.save(); c.clip('evenodd');   // fields and towns: faint seeded patches, so the land reads like a desaturated photo
    let s = 99991; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, n = Math.round(W * H / 900);
    for (let k = 0; k < n; k++) { const x = rnd() * W, y = rnd() * H, w = 6 + rnd() * 30, h = 4 + rnd() * 18, v = rnd() < 0.5 ? 255 : 0; c.fillStyle = `rgba(${v},${v},${v + (255 - v) * 0.2},${0.012 + rnd() * 0.022})`; c.save(); c.translate(x, y); c.rotate((rnd() - 0.5) * 0.8); c.fillRect(0, 0, w, h); c.restore(); }
    c.restore();
    if (lakes.length) { c.beginPath(); for (const r of lakes) ringPath(c, r); c.fillStyle = C2.sea; c.fill('evenodd'); }
    c.beginPath(); for (const r of land) ringPath(c, r); c.strokeStyle = C2.border; c.lineWidth = 1; c.stroke();
    // a 50 km grid from the city
    c.strokeStyle = `rgba(${LN_RGB},.04)`; const g = 50 * sc;
    for (let x = cx % g; x < W; x += g) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = cy % g; y < H; y += g) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // range rings, the low-altitude horizon dashed
    const step = VR > 300 ? 100 : 50; c.font = `400 10px ${F_NUM}`;
    for (let r = step; r <= VR; r += step) { c.strokeStyle = `rgba(${LN_RGB},${r === VR - (VR % step) ? 0.2 : 0.11})`; c.beginPath(); c.arc(cx, cy, r * sc, 0, 7); c.stroke(); c.fillStyle = C2.dim; c.fillText(String(r), cx + r * sc * 0.7071 + 4, cy - r * sc * 0.7071 - 3); }
    c.setLineDash([2, 6]); c.strokeStyle = `rgba(${LN_RGB},.18)`; c.beginPath(); c.arc(cx, cy, RAID.HORIZON * sc, 0, 7); c.stroke(); c.setLineDash([]);
    // bearing ticks on the outer ring
    const Rr = VR * sc; c.strokeStyle = `rgba(${LN_RGB},.3)`; c.textAlign = 'center'; c.font = `400 10px ${F_NUM}`;
    for (let b = 0; b < 360; b += 10) { const an = (b - 90) * D2R, l = b % 30 ? 4 : 8; c.beginPath(); c.moveTo(cx + Math.cos(an) * Rr, cy + Math.sin(an) * Rr); c.lineTo(cx + Math.cos(an) * (Rr - l), cy + Math.sin(an) * (Rr - l)); c.stroke(); if (!(b % 30) && !(phone && b % 90)) { c.fillStyle = C2.dim; c.fillText(String(b).padStart(3, '0'), cx + Math.cos(an) * (Rr - 16), cy + Math.sin(an) * (Rr - 16) + 3.5); } }
    c.textAlign = 'left';
    // towns: small open squares, ours grey, theirs red
    c.font = `500 11px ${F_LBL}`;
    for (const tw of towns) { const px = cx + tw.p[0] * sc, py = cy - tw.p[1] * sc; if (px < -40 || py < -10 || px > W + 10 || py > H + 10) continue; c.strokeStyle = tw.own ? C2.dim : `rgba(${HOS_RGB},.7)`; c.strokeRect(px - 2.5, py - 2.5, 5, 5); c.fillStyle = C2.dim; c.fillText(tr(tw.name).toUpperCase(), px + 7, py + 4); }
    // corner readouts, as on a drone feed
    c.font = `400 10.5px ${F_NUM}`; c.fillStyle = C2.dim; const ll = `${Math.abs(opts.lat).toFixed(2)}${opts.lat >= 0 ? 'N' : 'S'} ${Math.abs(opts.lng).toFixed(2)}${opts.lng >= 0 ? 'E' : 'W'}`;
    c.fillText(ll, 10, H - 10);
  }
  const diamond = (c, x, y, r) => { c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); };
  // a friendly air-defence symbol: a frame with an arc (missiles) or a chevron (guns)
  function friend(c, x, y, w, h, kind, col, fill) {
    c.fillStyle = fill; c.fillRect(x - w / 2, y - h / 2, w, h); c.strokeStyle = col; c.lineWidth = 1.5; c.strokeRect(x - w / 2, y - h / 2, w, h); c.beginPath();
    if (kind === 'sam') { c.moveTo(x - w * 0.3, y + h * 0.3); c.quadraticCurveTo(x, y - h * 0.7, x + w * 0.3, y + h * 0.3); }
    else { c.moveTo(x - w / 2, y + h / 2); c.lineTo(x, y - h * 0.1); c.lineTo(x + w / 2, y + h / 2); }
    c.stroke();
  }
  const brackets = (c, x, y, s) => { for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.beginPath(); c.moveTo(x + a * s, y + b * s * 0.45); c.lineTo(x + a * s, y + b * s); c.lineTo(x + a * s * 0.45, y + b * s); c.stroke(); } };
  let visSweep = 0;
  function drawScope(now, dt) {
    const c = sctx, t = S.t, Rpx = VR * sc, phone = innerWidth <= 760;
    drawMap();
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(mapCv, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // where the raid comes from: red bands on the rim before and early in the fight
    if (!started || t < 8) {
      const a = !started ? 0.65 + 0.25 * Math.sin(now / 400) : 1 - t / 8;
      for (const b of B) { const a0 = (b - 25 - 90) * D2R, a1 = (b + 25 - 90) * D2R; c.strokeStyle = `rgba(${HOS_RGB},${0.8 * a})`; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, Rpx - 2, a0, a1); c.stroke(); c.lineWidth = 1;
        const g = c.createRadialGradient(cx, cy, Rpx * 0.6, cx, cy, Rpx); g.addColorStop(0, `rgba(${HOS_RGB},0)`); g.addColorStop(1, `rgba(${HOS_RGB},${0.1 * a})`); c.fillStyle = g; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, Rpx, a0, a1); c.closePath(); c.fill(); }
      if (!started) { const bm = B.reduce((s, b) => s + b, 0) / B.length, an = (bm - 90) * D2R; c.font = `700 11px ${F_LBL}`; c.fillStyle = C2.hos; c.textAlign = 'center'; c.fillText(tr('THREAT AXIS'), cx + Math.cos(an) * (Rpx * 0.82), cy + Math.sin(an) * (Rpx * 0.82)); c.textAlign = 'left'; }
    }
    // the sweep: a thin line with a faint wake, enough to show when the next fix comes
    visSweep = started ? S.sweep : (now / 1000 / S.sweepT * 360) % 360;
    const a0 = (visSweep - 90) * D2R, far = Math.hypot(W, H);
    if (c.createConicGradient) { const g = c.createConicGradient(a0 - 30 * D2R, cx, cy); g.addColorStop(0, `rgba(${LN_RGB},0)`); g.addColorStop(30 / 360, `rgba(${LN_RGB},.07)`); g.addColorStop(30 / 360 + 0.001, `rgba(${LN_RGB},0)`); c.fillStyle = g; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, Rpx, a0 - 30 * D2R, a0); c.closePath(); c.fill(); }
    c.strokeStyle = `rgba(${LN_RGB},.45)`; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a0) * Rpx, cy + Math.sin(a0) * Rpx); c.stroke();
    // the danger zone: a live warhead close in
    const close = S.targets.some(m => !m.dead && RAID.TYPES[m.type].warhead && m.jammed === undefined && Math.hypot(m.x, m.y) < 60);
    if (close) { const k = 0.5 + 0.5 * Math.sin(now / 120); c.strokeStyle = `rgba(${HOS_RGB},${0.3 + 0.5 * k})`; c.lineWidth = 1.5; c.setLineDash([8, 4]); c.beginPath(); c.arc(cx, cy, 50 * sc, 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = `rgba(${HOS_RGB},${0.04 + 0.04 * k})`; c.fill(); c.lineWidth = 1; }
    // the SAM site and its reach; while deploying, how far things may be placed
    const [sx, sy] = toPx(S.site[0], S.site[1]);
    c.setLineDash([4, 4]); c.strokeStyle = `rgba(${FR_RGB},.5)`; c.beginPath(); c.arc(sx, sy, RAID.SAM_RANGE * sc, 0, 7); c.stroke(); c.setLineDash([]);
    if (!started) { c.setLineDash([2, 5]); c.strokeStyle = `rgba(${LN_RGB},.3)`; c.beginPath(); c.arc(cx, cy, RAID.DEPLOY_REACH * sc, 0, 7); c.stroke(); c.setLineDash([]); c.font = `400 10px ${F_NUM}`; c.fillStyle = C2.dim; c.fillText(tr('deploy zone'), cx + 4, cy + RAID.DEPLOY_REACH * sc - 5); }
    const ps = phone ? 1.2 : 1;
    friend(c, sx, sy, 28 * ps, 20 * ps, 'sam', C2.fr, `rgba(${FR_RGB},.16)`);
        if (drag && drag.site) { c.strokeStyle = C2.fr; c.setLineDash([4, 4]); c.beginPath(); c.arc(drag.px, drag.py, RAID.SAM_RANGE * sc, 0, 7); c.stroke(); c.setLineDash([]); c.strokeRect(drag.px - 14, drag.py - 10, 28, 20); }
    // bearings from the jammer: where a cut-in link really is
    for (const l of S.links) if (t - l.df < RAID.DF_SHOW) for (const m of S.targets) if (m.link === l.id && !m.dead) {
      const b = bearingOf(m.x, m.y) * D2R - Math.PI / 2, al = 1 - (t - l.df) / RAID.DF_SHOW; c.strokeStyle = `rgba(${ACT_RGB},${0.6 * al})`; c.setLineDash([10, 6]); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(b) * far, cy + Math.sin(b) * far); c.stroke(); c.setLineDash([]);
    }
    // fire groups, and the hunter's line to its prey
    for (const g of S.groups) {
      const [gx, gy] = toPx(g.x, g.y);
      if (g.dead) { c.strokeStyle = '#59616a'; c.lineWidth = 1.5; c.strokeRect(gx - 11, gy - 8, 22, 16); c.beginPath(); c.moveTo(gx - 11, gy - 8); c.lineTo(gx + 11, gy + 8); c.moveTo(gx + 11, gy - 8); c.lineTo(gx - 11, gy + 8); c.stroke(); continue; }
      const hunted = S.targets.some(m => !m.dead && m.prey === g.id && m.seen !== undefined && m.jammed === undefined), blink = hunted && Math.floor(now / 200) % 2;
      c.strokeStyle = hunted ? `rgba(${HOS_RGB},.7)` : g.shot ? `rgba(${ACT_RGB},.55)` : `rgba(${FR_RGB},.35)`; c.fillStyle = hunted ? `rgba(${HOS_RGB},${0.06 + 0.05 * Math.sin(now / 90)})` : `rgba(${FR_RGB},.04)`; c.lineWidth = 1;
      c.beginPath(); c.arc(gx, gy, RAID.GUN_RANGE * sc, 0, 7); c.fill(); c.stroke();
      if (g.moving) { const [tx, ty] = toPx(g.tx, g.ty); c.strokeStyle = `rgba(${FR_RGB},.6)`; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(gx, gy); c.lineTo(tx, ty); c.stroke(); c.setLineDash([]); c.strokeRect(tx - 3, ty - 3, 6, 6); }
      if (g.shot && Math.random() < dt * 14) { const m = S.targets.find(x => x.id === g.shot); if (m) parts.push({ x: g.x, y: g.y, vx: (m.x - g.x) * 3, vy: (m.y - g.y) * 3, life: 0.33, max: 0.33, color: ACT_RGB, size: 1.2, kind: 'tracer' }); }
      const col = blink ? C2.hos : C2.fr;
      friend(c, gx, gy, 22 * ps, 16 * ps, 'gun', col, blink ? `rgba(${HOS_RGB},.25)` : `rgba(${FR_RGB},.16)`);
      c.font = `400 10.5px ${F_NUM}`; c.fillStyle = col; c.fillText('FG' + (g.id + 1), gx + 14 * ps, gy - 6 * ps);
      if (drag && drag.g === g.id) { c.strokeStyle = C2.fr; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(gx, gy); c.lineTo(drag.px, drag.py); c.stroke(); c.beginPath(); c.arc(drag.px, drag.py, RAID.GUN_RANGE * sc, 0, 7); c.stroke(); c.setLineDash([]); }
    }
    // tracks: where the radar last saw each target (fading until the next sweep), its history and a velocity leader.
    // Every track wears the same hostile diamond: the screen never tells a decoy from a drone, the spectrum and bearings do.
    const live = S.targets.filter(m => m.paints.length && !(m.dead && t - m.paints[m.paints.length - 1][2] > 0.3)), blocks = !phone, boxes = [{ x: cx - 20, y: cy - 12, s: 0 }, { x: cx + 40, y: cy - 12, s: 0 }];   // the city's own label is taken
    for (const m of live) {
      const last = m.paints[m.paints.length - 1], age = t - last[2];
      const a = Math.max(0, 1 - age / (S.sweepT * 1.15)); if (a <= 0) continue;
      const jam = m.jammed !== undefined, col = jam ? '138,146,152' : HOS_RGB;
      m.paints.forEach((p, k) => { if (k === m.paints.length - 1) return; const [px, py] = toPx(p[0], p[1]); c.fillStyle = `rgba(${col},${0.5 * (k + 1) / m.paints.length * a})`; c.fillRect(px - 1, py - 1, 2, 2); });
      const [px, py] = toPx(last[0], last[1]);
      let spd = 0, hdg = 0;
      if (m.paints.length >= 2) {
        const pr = m.paints[m.paints.length - 2], dtp = Math.max(0.1, last[2] - pr[2]), k = S.sweepT / dtp; spd = Math.hypot(last[0] - pr[0], last[1] - pr[1]) / dtp; hdg = bearingOf(last[0] - pr[0], last[1] - pr[1]);
        if (!jam) { const [qx, qy] = toPx(last[0] + (last[0] - pr[0]) * k, last[1] + (last[1] - pr[1]) * k); c.strokeStyle = `rgba(${col},${0.85 * a})`; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px, py); c.lineTo(qx, qy); c.stroke(); }
      }
      const r = phone ? 7.5 : 6.5;
      diamond(c, px, py, r); c.fillStyle = `rgba(${col},${0.18 * a})`; c.fill(); c.strokeStyle = `rgba(${col},${a})`; c.lineWidth = 1.4; c.stroke();
      if (jam) { c.beginPath(); c.moveTo(px - r, py - r); c.lineTo(px + r, py + r); c.stroke(); }
      if (age < 0.35) { c.strokeStyle = `rgba(${col},${0.8 * (1 - age / 0.35)})`; c.lineWidth = 1; diamond(c, px, py, r + 2 + age * 22); c.stroke(); }
      const l = m.link >= 0 && S.links[m.link], tagL = l && t - l.df < 6 ? LINK(l.id) : '';
      // a data block (track number, link, speed and course) where it fits without covering another one
      const spot = blocks && [1, -1].map(s => ({ s, x: s > 0 ? px + 18 : px - 18 - 66, y: py - 30 })).find(b => !boxes.some(o => b.x < o.x + 68 && o.x < b.x + 68 && b.y < o.y + 28 && o.y < b.y + 28));
      if (spot) {
        boxes.push(spot); const lx = spot.s > 0 ? spot.x : spot.x + 66;
        c.strokeStyle = `rgba(${col},${0.5 * a})`; c.lineWidth = 1; c.beginPath(); c.moveTo(px + spot.s * r * 0.7, py - r * 0.7); c.lineTo(lx - spot.s * 2, py - 16); c.stroke();
        c.font = `500 10.5px ${F_NUM}`; c.textAlign = spot.s > 0 ? 'left' : 'right'; c.fillStyle = `rgba(${col},${a})`; c.fillText(`T${String(m.id).padStart(3, '0')}${tagL ? ' ' + tagL : ''}`, lx, py - 18);
        if (spd) { c.fillStyle = `rgba(124,133,140,${a})`; c.fillText(`${Math.round(spd * KMH)} ${String(Math.round(hdg)).padStart(3, '0')}°`, lx, py - 6); }
        c.textAlign = 'left';
      } else if (tagL) { c.font = `600 11px ${F_NUM}`; c.fillStyle = `rgba(${col},${a})`; c.fillText(tagL, px + r + 3, py - r); }
      if (m.prey >= 0 && m.type === 'hunter' && !jam) { const g = S.groups[m.prey]; if (g && !g.dead) { const [gx, gy] = toPx(g.x, g.y); c.strokeStyle = `rgba(${HOS_RGB},${0.7 * a})`; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(px, py); c.lineTo(gx, gy); c.stroke(); c.setLineDash([]); } }
      if (S.missiles.some(s => s.id === m.id && !s.done)) { c.strokeStyle = C2.act; c.lineWidth = 1.5; brackets(c, px, py, 12 + 1.5 * Math.sin(now / 90)); }
    }
    // our missiles: we always know where they are
    for (const s of S.missiles) {
      if (s.done) continue;
      c.setLineDash([2, 3]); c.strokeStyle = `rgba(${ACT_RGB},.8)`; c.lineWidth = 1.3; c.beginPath(); s.trail.forEach((p, k) => { const [x, y] = toPx(p[0], p[1]); k ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); c.setLineDash([]);
      if (Math.random() < dt * 30) smoke(s.x, s.y, 1, 0.9);
      const [px, py] = toPx(s.x, s.y); c.fillStyle = C2.act; c.beginPath(); c.arc(px, py, 3, 0, 7); c.fill();
    }
    // particles: sparks, debris, smoke and tracers
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k]; p.life -= dt; if (p.life <= 0) { parts.splice(k, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; const f = p.life / p.max;
      if (p.kind === 'smoke') { p.size += dt * 6; p.vx *= 0.98; p.vy *= 0.98; }
      else if (p.kind === 'debris') { p.vx *= 0.96; p.vy *= 0.96; } else { p.vx *= 0.93; p.vy *= 0.93; }
      const [px, py] = toPx(p.x, p.y);
      if (p.kind === 'smoke') { c.fillStyle = `rgba(${p.color},${0.1 * f})`; c.beginPath(); c.arc(px, py, Math.max(0.1, p.size), 0, 7); c.fill(); }
      else { c.fillStyle = `rgba(${p.color},${f})`; c.fillRect(px - p.size / 2, py - p.size / 2, p.size * (p.kind === 'debris' ? 1 : f + 0.3), p.size * (p.kind === 'debris' ? 1 : f + 0.3)); }
    }
    // shockwaves
    for (const f of S.fx) {
      const age = t - f.t; if (age > 1.2) continue; const [px, py] = toPx(f.x, f.y), k = age / 1.2;
      if (f.k === 'kill') { c.strokeStyle = f.how === 'ew' ? `rgba(${LN_RGB},${1 - k})` : `rgba(${ACT_RGB},${1 - k})`; c.lineWidth = 1.5 * (1 - k) + 0.5; c.beginPath(); c.arc(px, py, 3 + k * 24, 0, 7); c.stroke(); if (age < 0.12) glowDot(c, px, py, 6, '#fff3e0', 1 - age / 0.12); }
      else if (f.k === 'leak') { c.strokeStyle = `rgba(${HOS_RGB},${1 - k})`; c.lineWidth = 3 * (1 - k) + 1; c.beginPath(); c.arc(cx, cy, 12 + k * 90, 0, 7); c.stroke(); }
      else if (f.k === 'groupLost') { c.strokeStyle = `rgba(${HOS_RGB},${1 - k})`; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 4 + k * 34, 0, 7); c.stroke(); }
      else if (f.k === 'jam' && age < 1) { c.strokeStyle = `rgba(${ACT_RGB},${1 - age})`; c.lineWidth = 1; diamond(c, px, py, 9 + age * 14); c.stroke(); }
    }
    // the city: a framed block with its lights inside; hits put lights out and start fires
    c.strokeStyle = C2.line; c.lineWidth = 1.2; c.strokeRect(cx - 12, cy - 12, 24, 24);
    for (const l of lights) { if (Math.abs(l.x) > 11 || Math.abs(l.y) > 11) continue; if (l.on) { c.fillStyle = `rgba(230,225,205,${0.35 + 0.35 * l.w})`; c.fillRect(cx + l.x - 0.7, cy + l.y - 0.7, 1.4 * l.w + 0.5, 1.4 * l.w + 0.5); } else { c.fillStyle = 'rgba(90,60,50,.7)'; c.fillRect(cx + l.x - 0.6, cy + l.y - 0.6, 1.2, 1.2); } }
    for (const f of fires) { const fl = 0.7 + 0.3 * Math.sin(now / 60 + f.x); glowDot(c, cx + f.x, cy + f.y, 2.2 * fl, `rgba(255,${110 + Math.round(60 * fl)},40,1)`, 0.9); if (Math.random() < dt * 4) smoke(f.x / sc, -f.y / sc, 1, 2.4); }
    c.font = `700 12px ${F_LBL}`; c.fillStyle = C2.line; c.fillText(tr(opts.city).toUpperCase(), cx + 16, cy + 22);
    // score popups
    for (let k = popups.length - 1; k >= 0; k--) {
      const p = popups[k], age = (now - p.t) / 1000; if (age > 1.3) { popups.splice(k, 1); continue; }
      const [px, py] = toPx(p.x, p.y); c.globalAlpha = Math.min(1, (1.3 - age) * 2); c.fillStyle = p.color; c.font = `500 ${p.big ? 16 : 12.5}px ${F_NUM}`; c.textAlign = 'center'; c.fillText(p.text, px, py - 14 - age * 24); c.textAlign = 'left'; c.globalAlpha = 1;
    }
    // revolution time, bottom right
    c.font = `400 10.5px ${F_NUM}`; c.fillStyle = C2.dim; c.textAlign = 'right'; c.fillText(`${tr('SWEEP')} ${S.sweepT.toFixed(1)} ${tr('s')}`, W - 10, H - 10); c.textAlign = 'left';
  }
  // the spectrum: noise, a spike per live link (taller the closer its drones are), the jammer band and a heat-map waterfall
  function linkAmp(l) {
    let d = Infinity; for (const m of S.targets) if (m.link === l.id && !m.dead && m.jammed === undefined) d = Math.min(d, Math.hypot(m.x, m.y));
    return d === Infinity ? 0 : 0.5 + 0.5 * Math.max(0, 1 - d / RAID.R);
  }
  // inferno-like heat scale: violet → red → orange → pale yellow
  const HEAT = [[0, [10, 8, 24]], [0.22, [62, 12, 92]], [0.48, [170, 40, 78]], [0.72, [240, 112, 34]], [1, [252, 238, 170]]];
  const heat = v => { for (let k = 1; k < HEAT.length; k++) if (v <= HEAT[k][0]) { const [p0, c0] = HEAT[k - 1], [p1, c1] = HEAT[k], f = (v - p0) / (p1 - p0); return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f]; } return HEAT[HEAT.length - 1][1]; };
  function drawSpec() {
    const c = pctx, top = SH - wf.height, h = top - 6;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = C2.bg; c.fillRect(0, 0, SW, SH);
    const bins = Math.max(60, Math.floor(SW / 3)), lv = new Float32Array(bins), live = S.links.filter(l => linkAmp(l) > 0);
    for (let i = 0; i < bins; i++) { const f = i / (bins - 1); let v = 0.06 + Math.random() * 0.07; for (const l of live) { const d = (f - l.freq) / 0.011; v += linkAmp(l) * Math.exp(-d * d) * (0.85 + Math.random() * 0.15); } lv[i] = Math.min(1, v); }
    c.strokeStyle = `rgba(${LN_RGB},.06)`; c.lineWidth = 1; for (let k = 1; k < 10; k++) { const x = Math.round(k / 10 * SW) + 0.5; c.beginPath(); c.moveTo(x, 20); c.lineTo(x, SH); c.stroke(); }
    c.fillStyle = C2.dim; c.font = `400 10px ${F_NUM}`; for (let k = 1; k < 10; k += 2) c.fillText(MHZ(k / 10) + '', k / 10 * SW + 4, top - 4);
    c.beginPath(); for (let i = 0; i < bins; i++) { const x = i / (bins - 1) * SW, y = top - 3 - lv[i] * (h - 22); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = C2.line; c.lineWidth = 1; c.stroke();
    for (const l of live) {
      const x = l.freq * SW, y = top - 3 - linkAmp(l) * (h - 22);
      if (S.t - l.df < 6 || l.hold > 0) { c.fillStyle = l.hold > 0 ? C2.act : C2.line; c.font = `500 11px ${F_NUM}`; c.textAlign = 'center'; c.fillText(LINK(l.id) + (l.hop ? '~' : ''), x, y - 6); c.textAlign = 'left'; }
      if (l.hold > 0) { const k = l.hold / RAID.JAM_HOLD; c.strokeStyle = C2.act; c.lineWidth = 2; c.beginPath(); c.arc(x, y - 22, 7, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); c.stroke(); c.lineWidth = 1; }
    }
    // the waterfall scrolls down one row per frame
    const jx = S.jam.f * SW, bw = RAID.JAM_BW * SW;
    wctx.drawImage(wf, 0, 1);
    const row = wctx.createImageData(SW, 1);
    for (let x = 0; x < SW; x++) { const v = lv[Math.min(bins - 1, Math.floor(x / SW * bins))], [r, g, b] = heat(Math.min(1, v * 1.05)), k = x * 4; row.data[k] = r; row.data[k + 1] = g; row.data[k + 2] = b; row.data[k + 3] = 255; }
    wctx.putImageData(row, 0, 0);
    c.drawImage(wf, 0, top, SW, wf.height);
    // the jammer band: orange brackets, filled while transmitting
    c.fillStyle = S.jam.on ? `rgba(${ACT_RGB},.16)` : `rgba(${ACT_RGB},.05)`; c.fillRect(jx - bw, 0, bw * 2, top);
    c.strokeStyle = S.jam.on ? C2.act : `rgba(${ACT_RGB},.55)`; c.lineWidth = S.jam.on ? 1.5 : 1; c.beginPath(); c.moveTo(jx - bw, 4); c.lineTo(jx - bw, SH); c.moveTo(jx + bw, 4); c.lineTo(jx + bw, SH); c.moveTo(jx - bw, 4); c.lineTo(jx - bw + 6, 4); c.moveTo(jx + bw, 4); c.lineTo(jx + bw - 6, 4); c.stroke(); c.lineWidth = 1;
    c.strokeStyle = C2.rule; c.beginPath(); c.moveTo(0, top + 0.5); c.lineTo(SW, top + 0.5); c.stroke();
    $('rFreq').textContent = MHZ(S.jam.f) + ' ' + tr('MHz') + (S.jam.on ? ' · TX' : '');
    staticOn(S.jam.on, live.some(l => Math.abs(l.freq - S.jam.f) <= RAID.JAM_BW) ? 1 : 0);
  }
  const GST = { dead: 'LOST', fire: 'FIRING', mv: 'MOVING', hunted: 'HUNTED', '': 'READY' };
  function drawSide(now) {
    $('rAmmo').innerHTML = Array.from({ length: S.samsMax }, (_, k) => `<i class="${k < S.sams ? '' : 'u'}"></i>`).join('') + `<b class="notr">${S.sams}/${S.samsMax}</b>`;
    const ms = S.missiles.find(s => !s.done), tm = ms && S.targets.find(m => m.id === ms.id);
    $('rEng').className = 'rEng' + (tm ? ' on' : ''); $('rEng').innerHTML = `<b>${tr('ENGAGING')}</b><span class="notr">${tm ? `T${String(tm.id).padStart(3, '0')} · ${fmtB(bearingOf(tm.x, tm.y))} · ${Math.round(Math.hypot(tm.x, tm.y))} ${tr('km')}` : '—'}</span>`;
    $('rGrp').innerHTML = S.groups.map(g => { const hunted = !g.dead && S.targets.some(m => !m.dead && m.prey === g.id && m.seen !== undefined && m.jammed === undefined), st = g.dead ? 'dead' : hunted ? 'hunted' : g.shot ? 'fire' : g.moving ? 'mv' : ''; return `<div class="${st}"><b class="notr">FG${g.id + 1}</b><i></i><span>${tr(GST[st])}</span></div>`; }).join('');
    const b = $('rBat'); b.firstChild.style.width = (S.jam.battery / S.jam.max * 100).toFixed(0) + '%'; b.classList.toggle('low', S.jam.battery < 0.25 * S.jam.max); b.classList.toggle('on', S.jam.on);
    $('rEwF').textContent = `${Math.round(S.jam.battery / S.jam.max * 100)}% · ${MHZ(S.jam.f)} ${tr('MHz')}`;
    const st = S.stats, down = st.kills.sam + st.kills.guns + st.kills.ew;
    $('rsAir').textContent = S.targets.filter(m => !m.dead).length + S.pending.length; $('rsDown').textContent = down; $('rsLeak').textContent = st.leaks;
    $('rPts').textContent = S.points;
    const combo = S.t - S.lastKill <= RAID.COMBO_T && S.chain >= 2; $('rCombo').textContent = combo ? '×' + S.chain : ''; $('rCombo').classList.toggle('on', combo);
    $('rTally').innerHTML = `<span>SAM<b class="notr">${st.kills.sam}</b></span><span>Guns<b class="notr">${st.kills.guns}</b></span><span>EW<b class="notr">${st.kills.ew}</b></span><span class="w">Decoys<b class="notr">${st.wasted}</b></span>`;
  }

  // ---------- the loop: a fixed simulation step, drawing every frame ----------
  let last = performance.now(), acc = 0, raf = 0, sideT = 0, beatT = 0;
  const firstTips = [[1.5, 'Drag the triangles onto the approaches'], [6, 'Hold on a spike in the spectrum to jam a link'], [23, 'Fast blips have long vectors: SAM them']];
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = Math.max(last, now);   // the first animation frame can be stamped a hair before the opening
    if (started && !ended) { acc += dt; while (acc >= RAID.DT) { raid.step(); acc -= RAID.DT; } }
    for (const f of S.fx) if (f.n > fxSeen) { onFx(f); fxSeen = f.n; }
    flushContacts();
    drawScope(now, dt); drawSpec(); if (now - sideT > 100) { drawSide(now); sideT = now; }
    $('rFlash').style.opacity = now - flashT < 260 ? 1 : 0;
    if (now > tipT) $('rTip').style.opacity = 0;
    for (const tp of firstTips) if (started && !tp.done && S.t >= tp[0]) { tp.done = true; tip(tp[1], 4); }
    for (const cl of calls) if (!cl.out && now - cl.t > 4200) { cl.out = true; cl.d.classList.add('out'); setTimeout(() => cl.d.remove(), 400); }
    // a heartbeat while something with a warhead is close
    if (started && !ended && now - beatT > 750 && S.targets.some(m => !m.dead && RAID.TYPES[m.type].warhead && m.jammed === undefined && Math.hypot(m.x, m.y) < 60)) { beatT = now; beep(55, 0.18, 'sine', 0.14); beep(50, 0.16, 'sine', 0.1, 0, 0.2); }
    if (started && S.done && !ended) finish();
  }
  raf = requestAnimationFrame(frame);

  function finish() {
    ended = true; staticOn(false, 0); const r = raid.result();
    let best = 0; try { best = +localStorage.getItem('sl-raid-best') || 0; if (r.score > best) localStorage.setItem('sl-raid-best', r.score); } catch (e) {}
    const rec = r.score > best && r.score > 0;
    const col = { S: C2.line, A: C2.fr, B: C2.unk, C: C2.unk, D: C2.hos }[r.rating];
    const head = r.leaks === 0 ? 'The sky over the city is clear' : r.leaks <= 2 ? 'A few got through' : 'The raid got through';
    const tt = Math.floor(S.t);
    $('rEnd').innerHTML = `<div class="rBox"><div class="rKh"><b style="color:${col}">RAID OVER</b><span class="notr">${tr(opts.city).toUpperCase()} · T+${String(Math.floor(tt / 60)).padStart(2, '0')}:${String(tt % 60).padStart(2, '0')}</span></div><div class="rRes"><div class="rGrade notr" style="color:${col}">${r.rating}</div>
      <div><h2>${head}</h2><p>${r.down} of ${r.total} shot down · ${r.leaks} of ${r.warheads} warheads got through</p><div class="rPts"><span class="notr">${r.score}</span><small>POINTS</small>${rec ? '<span class="rRec">NEW RECORD</span>' : ''}</div></div></div>
      <div class="rNums"><div><b>${r.kills.sam}</b><span>SAM · ${r.fired} fired</span></div><div><b>${r.kills.guns}</b><span>fire groups</span></div><div><b>${r.kills.ew}</b><span>EW · ${r.jammedLinks} links cut</span></div><div><b class="notr">×${r.bestChain}</b><span>best streak</span></div></div>
      ${r.medals.length ? `<div class="rMedals">${r.medals.map((m, k) => `<span style="animation-delay:${0.3 + k * 0.15}s">${MEDALS[m]}</span>`).join('')}</div>` : ''}
      <div class="rNotes">${r.wasted ? `<p>${r.wasted} SAM spent on decoys. A decoy has no link: no spike in the spectrum, no bearing on the radar.</p>` : ''}
      ${r.groupsLost ? '<p>The hunter drone got a fire group. Move a group away when the red line points at it, or SAM the hunter.</p>' : ''}</div>
      <div class="rBtns">${opts.onAgain ? '<button class="rGo" id="rAgain">AGAIN</button>' : ''}<button class="rGo sec" id="rBack">BACK TO THE WAR</button></div></div>`;
    $('rEnd').hidden = false;
    if ($('rAgain')) $('rAgain').onclick = () => { close(); opts.onAgain(); };
    $('rBack').onclick = () => close();
    r.leaks === 0 ? (beep(523, 0.2, 'triangle', 0.05), beep(659, 0.2, 'triangle', 0.05, 0, 0.15), beep(784, 0.5, 'triangle', 0.05, 0, 0.3)) : beep(160, 0.6, 'sawtooth', 0.04, -60);
    if (opts.onEnd) opts.onEnd(r, raid.log.slice());
  }
  function close() {
    cancelAnimationFrame(raf); clearInterval(deployT); ro.disconnect(); removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true);
    try { staticNode && staticNode.stop(); } catch (e) {} ov.remove(); if (opts.onClose) opts.onClose();
  }
  // tick(n): run n frames by hand (tests, and a hidden tab where animation frames stop)
  return { close, raid, start: () => $('rGo').click(), tick: (n = 1) => { for (let k = 0; k < n; k++) { last -= 1000 / 30; frame(performance.now()); cancelAnimationFrame(raf); } raf = requestAnimationFrame(frame); } };
}
