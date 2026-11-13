/* MOCK Ban Ngân hàng — chỉ tiêu tài chính & chương trình ưu đãi. Số liệu minh họa, KHÔNG phải BCTC thật. */
window.AFA = window.AFA || {};
AFA.mock = AFA.mock || {};

/* Schema BankFundamentals {
 *   bankId, bank, group, period,
 *   totalAssets, loans, deposits, pbt (nghìn tỷ VND; pbt = LNTT lũy kế kỳ),
 *   pbtYoY, creditGrowth (YTD), nim, casa, npl, llr (bao phủ nợ xấu), car, roe, roa (%) }
 */
AFA.mock.bankPeriod = '9M/2026';

AFA.mock.bankMetrics = [
  // nhóm: scale = Quy mô, efficiency = Hiệu quả, quality = Chất lượng tài sản & an toàn vốn
  { id: 'totalAssets', label: 'Total assets', unit: 'VND tn', group: 'scale', dp: 0, better: 'high' },
  { id: 'loans', label: 'Loans', unit: 'VND tn', group: 'scale', dp: 0, better: 'high' },
  { id: 'deposits', label: 'Customer deposits', unit: 'VND tn', group: 'scale', dp: 0, better: 'high' },
  { id: 'creditGrowth', label: 'Credit growth', unit: '% YTD', group: 'scale', dp: 1, better: 'high' },
  { id: 'pbt', label: 'Pre-tax profit', unit: 'VND tn', group: 'efficiency', dp: 1, better: 'high' },
  { id: 'pbtYoY', label: 'PBT YoY', unit: '%', group: 'efficiency', dp: 1, better: 'high' },
  { id: 'nim', label: 'NIM', unit: '%', group: 'efficiency', dp: 2, better: 'high' },
  { id: 'casa', label: 'CASA', unit: '%', group: 'efficiency', dp: 1, better: 'high' },
  { id: 'roe', label: 'ROE', unit: '%', group: 'efficiency', dp: 1, better: 'high' },
  { id: 'roa', label: 'ROA', unit: '%', group: 'efficiency', dp: 2, better: 'high' },
  { id: 'npl', label: 'NPL ratio', unit: '%', group: 'quality', dp: 2, better: 'low' },
  { id: 'llr', label: 'NPL coverage', unit: '%', group: 'quality', dp: 0, better: 'high' },
  { id: 'car', label: 'CAR', unit: '%', group: 'quality', dp: 1, better: 'high' },
];

// [bankId, bank, group, totalAssets, loans, deposits, creditGrowth, pbt, pbtYoY, nim, casa, npl, llr, car, roe, roa]
AFA.mock.bankFundamentals = [
  ['VCB', 'Vietcombank', 'state', 2150, 1550, 1650, 11.5, 33.5, 4.5, 2.9, 33.0, 1.1, 210, 11.8, 17.5, 1.6],
  ['BID', 'BIDV', 'state', 2950, 2250, 2250, 12.0, 24.5, 6.0, 2.5, 19.0, 1.5, 120, 9.4, 17.0, 0.9],
  ['CTG', 'VietinBank', 'state', 2700, 1950, 1850, 13.5, 26.0, 12.0, 2.7, 23.0, 1.3, 150, 10.0, 18.5, 1.1],
  ['AGR', 'Agribank', 'state', 2300, 1800, 2050, 9.5, 20.0, 5.0, 2.9, 15.0, 1.8, 95, 9.0, 14.0, 0.7],
  ['TCB', 'Techcombank', 'private', 1080, 780, 560, 16.0, 23.0, 8.0, 3.9, 36.0, 1.2, 105, 14.5, 16.5, 2.4],
  ['MBB', 'MB Bank', 'private', 1250, 920, 820, 17.5, 24.5, 15.0, 3.8, 39.0, 1.6, 95, 11.5, 21.0, 2.2],
  ['ACB', 'ACB', 'private', 900, 640, 600, 14.0, 15.0, 5.5, 3.2, 22.0, 1.4, 110, 11.8, 19.5, 1.9],
  ['VPB', 'VPBank', 'private', 1100, 820, 600, 19.0, 17.5, 30.0, 5.3, 15.0, 3.4, 50, 13.0, 11.5, 1.6],
  ['STB', 'Sacombank', 'private', 800, 590, 650, 12.0, 11.5, 25.0, 3.5, 17.0, 2.1, 70, 10.2, 18.0, 1.3],
  ['HDB', 'HDBank', 'private', 750, 520, 450, 20.0, 14.0, 28.0, 4.8, 11.0, 1.7, 60, 13.2, 25.0, 2.2],
  ['VIB', 'VIB', 'private', 470, 330, 280, 14.5, 7.5, 5.0, 4.0, 15.0, 2.8, 45, 12.0, 17.0, 1.6],
  ['TPB', 'TPBank', 'private', 430, 270, 260, 17.0, 6.2, 18.0, 3.6, 21.0, 1.8, 60, 13.0, 15.0, 1.4],
  ['SHB', 'SHB', 'private', 760, 560, 560, 13.0, 10.5, 20.0, 3.2, 8.0, 2.9, 55, 12.2, 15.5, 1.2],
  ['LPB', 'LPBank', 'private', 480, 360, 310, 18.0, 9.0, 40.0, 3.7, 10.0, 1.4, 85, 12.5, 22.0, 2.0],
].map(r => {
  const keys = ['bankId', 'bank', 'group', 'totalAssets', 'loans', 'deposits', 'creditGrowth', 'pbt', 'pbtYoY', 'nim', 'casa', 'npl', 'llr', 'car', 'roe', 'roa'];
  const o = Object.fromEntries(keys.map((k, i) => [k, r[i]]));
  o.period = AFA.mock.bankPeriod;
  o.source = 'mock';
  return o;
});

/* Schema RatePromo { bankId, title, product: 'deposit'|'lending', rate, condition, endsInDays } */
AFA.mock.ratePromos = [
  ['HDB', 'Online 12M term deposit — +0.3% p.a. bonus', 'deposit', 5.9, 'From VND 100m, opened via the app', 18],
  ['VPB', 'Mortgage fixed for the first 12 months', 'lending', 5.9, 'Customers with payroll at VPBank', 45],
  ['TCB', 'Partner-project mortgage — 24-month promo', 'lending', 6.5, 'Projects on the partner list', 60],
  ['MBB', '"Loc Phat" digital savings — tiered rates', 'deposit', 5.6, '18–24M terms, via the MB app', 30],
  ['BID', 'Short-term business credit package for SMEs', 'lending', 5.2, 'Loans under 12 months, secured', 75],
  ['SHB', 'Year-end savings — +0.2% p.a. bonus', 'deposit', 6.0, 'Terms from 13M, from VND 2bn', 25],
  ['VCB', 'Secured consumer loan — 6-month promo', 'lending', 6.8, 'Existing customers, online application', 40],
].map(([bankId, title, product, rate, condition, endsInDays]) => ({ bankId, title, product, rate, condition, endsInDays }));
