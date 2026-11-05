/* 勁格科技 — 共用加工單價與計價公式
 * 材料計算機、表面加工試算、深孔加工計算機共用這一份；單價有調整只需改這裡。
 * 公式與數值由各工具原有程式原樣搬出，未更動。
 * 各函式只回傳「該廠商／該條件」的金額；「多家取哪一家」由呼叫端決定。
 */
(function (root) {
  'use strict';

  var MM2IN2 = 645;
  function areaIN2(d, l) { return Math.PI * d * l / MM2IN2; }

  // ── 研磨（外圓） ──
  function grindFee(d, l, passes) {
    var a = Math.PI * (d / 25.4) * (l / 25.4);
    var c1 = a * 2;
    var c2 = a * 2 * 1.5;
    var ld = l / d;
    var isLong = ld > 25;
    var c1Total = isLong ? c1 * 2 : c1;
    var c2Total = isLong ? c2 * 2 : c2;
    var sub = passes === 1 ? c1Total : c1Total + c2Total;
    var total = Math.max(300, sub);
    return { area: a, c1: c1, c2: c2, c1Total: c1Total, c2Total: c2Total, isLong: isLong, ld: ld, total: total, passes: passes };
  }

  // ── 膛孔 ──
  function boreVendors(d, l) {
    var a = areaIN2(d, l);
    var vs = [
      { name: '利峰', unit: 2.5, min: 400, outOfRange: false },
      { name: '益川', unit: 1.2, min: 300, outOfRange: d < 20 || d > 160 }
    ];
    return vs.map(function (v) {
      return { name: v.name, unit: v.unit, min: v.min, outOfRange: v.outOfRange,
        area: a, calc: a * v.unit, total: v.outOfRange ? null : Math.max(a * v.unit, v.min) };
    });
  }

  // ── 拋光（軸心）→ 只有宏光 ──
  function polishShaft(d, l) {
    var a = areaIN2(d, l);
    return { area: a, unit: 1.725, min: 140, total: Math.max(a * 1.725, 140) };
  }

  // ── 拋光（鋼管）→ 利峰 + 益川 + 宏光 ──
  function polishCylinderVendors(d, l) {
    var a = areaIN2(d, l);
    var vs = [
      { name: '利峰', unit: 2.0, min: 400, outOfRange: false },
      { name: '益川', unit: 1.2, min: 300, outOfRange: d < 20 || d > 160 },
      { name: '宏光', unit: 1.35, min: 200, outOfRange: d > 150 && l > 1200 }
    ];
    return vs.map(function (v) {
      return { name: v.name, unit: v.unit, min: v.min, outOfRange: v.outOfRange,
        area: a, calc: a * v.unit, total: v.outOfRange ? null : Math.max(a * v.unit, v.min) };
    });
  }

  // ── 電鍍查表 ──
  var CR_SHAFT = ['cr4_6', 'cr6_8', 'cr15', 'cr20', 'cr25'];
  var CR_CYLINDER = ['cr4_6', 'cr6_8', 'cr10', 'cr20'];
  var CR_LABELS = { cr4_6: 'CR 4-6條', cr6_8: 'CR 6-8條', cr10: 'CR 10條', cr15: 'CR 15條', cr20: 'CR 20條', cr25: 'CR 25條' };

  function plateFee(type, cr, d, l) {
    if (!type || !cr || !d || !l) return null;
    var a = areaIN2(d, l);
    var unit, minP;
    if (type === 'shaft') {
      if (d > 400) return 'estimate';
      if (cr === 'cr4_6') { unit = d <= 250 ? 3.5 : d <= 400 ? 4.5 : null; minP = 300; }
      else if (cr === 'cr6_8') { unit = d <= 250 ? 4.2 : d <= 400 ? 5.2 : null; minP = 400; }
      else if (cr === 'cr15') {
        if (d <= 80) { unit = 5.4; minP = 500; }
        else if (d <= 120) { if (l > 3000) return 'estimate'; unit = 8.4; minP = 500; }
        else if (d <= 300) { if (l > 3000) return 'estimate'; unit = 11.4; minP = 500; }
        else return 'estimate';
      }
      else if (cr === 'cr20') {
        if (d <= 80) { unit = 6.3; minP = 1000; }
        else if (d <= 120) { if (l > 3000) return 'estimate'; unit = 9.2; minP = 1000; }
        else if (d <= 300) { if (l > 3000) return 'estimate'; unit = 12.2; minP = 1000; }
        else return 'estimate';
      }
      else if (cr === 'cr25') {
        if (d <= 80) { unit = 7.2; minP = 1200; }
        else if (d <= 120) { if (l > 3000) return 'estimate'; unit = 10; minP = 1200; }
        else if (d <= 300) { if (l > 3000) return 'estimate'; unit = 13; minP = 1200; }
        else return 'estimate';
      }
    }
    if (type === 'cylinder') {
      if (d > 400 || l >= 3000) return 'estimate';
      if (cr === 'cr4_6') { unit = d <= 300 ? 3.5 : d <= 400 ? 4.5 : null; minP = 380; }
      else if (cr === 'cr6_8') { unit = d <= 300 ? 4.2 : d <= 400 ? 5.2 : null; minP = 550; }
      else if (cr === 'cr10') { unit = d <= 300 ? 5.7 : d <= 400 ? 6.7 : null; minP = 720; }
      else if (cr === 'cr20') { unit = d <= 300 ? 6.3 : d <= 400 ? 7.3 : null; minP = 1000; }
    }
    if (unit == null) return 'estimate';
    return { area: a, unit: unit, minP: minP, total: Math.max(a * unit, minP) };
  }

  // 電鍍工序合計（mode: 'plate' 電鍍 | 'strip' 退電 | 'replate' 退電再電）
  // 回傳 { total } 或 { estimate:true } 或 null（條件未選齊）
  function platingJob(type, mode, cr, d, l) {
    if (!d || !l) return null;
    if (mode === 'strip') return { total: areaIN2(d, l) * 1.6 };
    if (!cr) return null;
    var info = plateFee(type, cr, d, l);
    if (info === 'estimate') return { estimate: true };
    if (!info) return null;
    if (mode === 'replate') return { total: areaIN2(d, l) * 1.0 + info.total, strip: areaIN2(d, l) * 1.0, plate: info.total };
    return { total: info.total, plate: info.total };
  }

  // ── 深孔（廷翼實業 CNC 鎗鑽） ──
  var DEEP_RATES = [
    { d: 3, p: 2.50 }, { d: 3.5, p: 1.50 }, { d: 4, p: 1.00 },
    { d: 5, p: 0.70 }, { d: 6, p: 0.70 }, { d: 7, p: 0.70 }, { d: 8, p: 0.70 }, { d: 9, p: 0.70 }, { d: 10, p: 0.70 },
    { d: 11, p: 0.70 }, { d: 12, p: 0.70 }, { d: 13, p: 0.70 }, { d: 14, p: 0.70 }, { d: 15, p: 0.70 }, { d: 16, p: 0.70 }, { d: 17, p: 0.70 },
    { d: 18, p: 0.90 }, { d: 19, p: 0.90 },
    { d: 20, p: 1.00 }, { d: 21, p: 1.00 }, { d: 22, p: 1.00 },
    { d: 23, p: 1.20 }, { d: 24, p: 1.30 }, { d: 25, p: 1.30 }, { d: 26, p: 1.60 },
    { d: 27, p: 2.00 }, { d: 28, p: 2.00 }, { d: 30, p: 2.00 },
    { d: 32, p: 2.60 }, { d: 35, p: 3.80 }, { d: 40, p: 5.00 }, { d: 42, p: 5.50 },
    { d: 45, p: 8.00 }, { d: 50, p: 11.00 }, { d: 55, p: 14.00 }
  ];

  // 回傳 {ok:false, msg} 或 {ok:true, maxSingle, maxDouble}
  function deepLimit(od, dia) {
    if (dia > 50) return { ok: false, msg: '孔徑超出加工範圍（最大 φ50）' };
    if (dia >= od) return { ok: false, msg: '孔徑不可大於或等於工件外徑' };
    if (od <= 55) {
      if (dia <= 4) return { ok: true, maxSingle: 600, maxDouble: 600 };
      if (dia <= 32) return { ok: true, maxSingle: 1500, maxDouble: 3000 };
      return { ok: true, maxSingle: 1200, maxDouble: 1200 };
    }
    return { ok: true, maxSingle: 1200, maxDouble: 1200 };
  }

  // 深孔費用：回傳 {total, isDouble, px, lim} 或 {error:'訊息'}
  function deepHoleFee(od, dia, depth) {
    var r = DEEP_RATES.filter(function (x) { return x.d === dia; })[0];
    if (!r) return { error: '請選擇孔徑' };
    var lim = deepLimit(od, dia);
    if (!lim.ok) return { error: lim.msg + '，需另行報價' };
    if (depth > lim.maxDouble) return { error: '超出加工範圍（最大 ' + lim.maxDouble + ' mm），需另行報價' };
    return { total: r.p * depth, px: r.p, isDouble: depth > lim.maxSingle, lim: lim };
  }

  // ── 高週波（圓周面）：≤1000mm $2/in²、超過 $3/in²；
  //    最低消費：全長 ≤1000mm 以 $100 計、全長 >1000mm 以 $300 計（依高週波計算機頁面所列規則）──
  function inductionCylinder(d, l) {
    var a = Math.PI * d * l / 645.16;
    var rate = l <= 1000 ? 2 : 3;
    var minFee = l <= 1000 ? 100 : 300;
    return { area: a, rate: rate, min: minFee, total: Math.max(a * rate, minFee) };
  }

  root.JingePricing = {
    MM2IN2: MM2IN2, areaIN2: areaIN2,
    grindFee: grindFee, boreVendors: boreVendors, polishShaft: polishShaft,
    polishCylinderVendors: polishCylinderVendors,
    CR_SHAFT: CR_SHAFT, CR_CYLINDER: CR_CYLINDER, CR_LABELS: CR_LABELS,
    plateFee: plateFee, platingJob: platingJob,
    DEEP_RATES: DEEP_RATES, deepLimit: deepLimit, deepHoleFee: deepHoleFee,
    inductionCylinder: inductionCylinder
  };
})(typeof window !== 'undefined' ? window : globalThis);
