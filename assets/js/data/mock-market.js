/* MOCK market data — giá trị minh họa, KHÔNG phải dữ liệu thật.
 * Cấu trúc trùng với schema Quote để thay bằng API thật mà không đổi UI.
 * Lịch sử giá được sinh tự động (random walk có seed) trong mock-provider.
 */
window.AFA = window.AFA || {};
AFA.mock = AFA.mock || {};

// [symbol, name, assetClass, departmentId, unit, dp, price, changePct, volume]
AFA.mock.instruments = [
  // Chứng khoán Việt Nam
  ['VNINDEX', 'VN-Index', 'index', 'vn-equities', 'pts', 2, 1652.34, 0.74, 845e6],
  ['VN30', 'VN30', 'index', 'vn-equities', 'pts', 2, 1798.52, 0.92, 312e6],
  ['HNXINDEX', 'HNX-Index', 'index', 'vn-equities', 'pts', 2, 265.41, 0.21, 92e6],
  ['UPCOM', 'UPCOM-Index', 'index', 'vn-equities', 'pts', 2, 110.25, -0.12, 61e6],
  ['VCB', 'Vietcombank', 'stock', 'vn-banks', 'VND', 0, 61500, 1.15, 3.2e6],
  ['TCB', 'Techcombank', 'stock', 'vn-banks', 'VND', 0, 36400, 0.83, 12.5e6],
  ['BID', 'BIDV', 'stock', 'vn-banks', 'VND', 0, 39800, 0.63, 4.1e6],
  ['CTG', 'VietinBank', 'stock', 'vn-banks', 'VND', 0, 41200, 0.98, 6.3e6],
  ['MBB', 'MB Bank', 'stock', 'vn-banks', 'VND', 0, 26450, 1.73, 18.2e6],
  ['ACB', 'ACB', 'stock', 'vn-banks', 'VND', 0, 25900, 0.39, 9.8e6],
  ['VPB', 'VPBank', 'stock', 'vn-banks', 'VND', 0, 21350, -0.7, 21.4e6],
  ['STB', 'Sacombank', 'stock', 'vn-banks', 'VND', 0, 45600, 2.25, 11.7e6],
  ['HDB', 'HDBank', 'stock', 'vn-banks', 'VND', 0, 28700, 1.06, 8.9e6],
  ['FPT', 'FPT Corp', 'stock', 'vn-equities', 'VND', 0, 98200, 2.3, 6.8e6],
  ['HPG', 'Hoa Phat Group', 'stock', 'vn-equities', 'VND', 0, 27850, -0.54, 28.1e6],
  ['VIC', 'Vingroup', 'stock', 'vn-equities', 'VND', 0, 152000, 3.4, 5.4e6],
  ['VNM', 'Vinamilk', 'stock', 'vn-equities', 'VND', 0, 61200, -0.33, 2.9e6],
  ['MWG', 'Mobile World', 'stock', 'vn-equities', 'VND', 0, 79500, 1.4, 4.7e6],
  ['SSI', 'SSI Securities', 'stock', 'vn-equities', 'VND', 0, 38150, 4.1, 22.6e6],
  // Chứng khoán Mỹ
  ['SPX', 'S&P 500', 'index', 'us-equities', 'pts', 2, 6905.12, 0.62, null],
  ['IXIC', 'Nasdaq Composite', 'index', 'us-equities', 'pts', 2, 23580.4, 0.95, null],
  ['DJI', 'Dow Jones', 'index', 'us-equities', 'pts', 2, 47820.5, -0.18, null],
  ['VIX', 'CBOE VIX', 'indicator', 'us-equities', 'pts', 2, 15.2, -4.2, null],
  ['US10Y', 'US 10Y Yield', 'indicator', 'us-equities', '%', 3, 4.182, 0.84, null],
  ['DXY', 'US Dollar Index', 'indicator', 'us-equities', 'pts', 2, 99.62, 0.15, null],
  ['AAPL', 'Apple', 'stock', 'us-equities', 'USD', 2, 268.4, 0.4, 48e6],
  ['MSFT', 'Microsoft', 'stock', 'us-equities', 'USD', 2, 512.3, 1.1, 21e6],
  ['NVDA', 'Nvidia', 'stock', 'us-equities', 'USD', 2, 198.7, 3.2, 210e6],
  ['AMZN', 'Amazon', 'stock', 'us-equities', 'USD', 2, 241.5, 0.7, 39e6],
  ['GOOGL', 'Alphabet', 'stock', 'us-equities', 'USD', 2, 285.1, 1.6, 31e6],
  ['META', 'Meta Platforms', 'stock', 'us-equities', 'USD', 2, 702.4, -0.5, 14e6],
  ['TSLA', 'Tesla', 'stock', 'us-equities', 'USD', 2, 438.2, -2.1, 95e6],
  // Tỷ giá
  ['USDVND', 'USD/VND', 'fx', 'fx', 'VND', 0, 26352, 0.06, null],
  ['EURVND', 'EUR/VND', 'fx', 'fx', 'VND', 0, 30618, -0.11, null],
  ['JPYVND', 'JPY/VND', 'fx', 'fx', 'VND', 2, 171.35, -0.42, null],
  ['CNYVND', 'CNY/VND', 'fx', 'fx', 'VND', 0, 3702, 0.03, null],
  ['GBPVND', 'GBP/VND', 'fx', 'fx', 'VND', 0, 34810, 0.08, null],
  ['EURUSD', 'EUR/USD', 'fx', 'fx', 'USD', 4, 1.1619, -0.17, null],
  ['USDJPY', 'USD/JPY', 'fx', 'fx', 'JPY', 2, 153.8, 0.48, null],
  // Hàng hóa
  ['XAUUSD', 'Gold', 'commodity', 'commodities', 'USD/oz', 2, 3982.4, 0.85, null],
  ['XAGUSD', 'Silver', 'commodity', 'commodities', 'USD/oz', 2, 48.62, 1.35, null],
  ['WTI', 'WTI Crude', 'commodity', 'commodities', 'USD/bbl', 2, 61.85, 1.12, null],
  ['BRENT', 'Brent Crude', 'commodity', 'commodities', 'USD/bbl', 2, 65.72, 1.08, null],
  ['NG', 'Natural Gas', 'commodity', 'commodities', 'USD/MMBtu', 3, 4.32, -1.8, null],
  ['HG', 'Copper', 'commodity', 'commodities', 'USD/lb', 3, 5.02, 0.6, null],
  // Lãi suất liên ngân hàng (%/năm)
  ['VNIBOR-ON', 'Interbank O/N', 'rate', 'bank-rates', '% p.a.', 2, 3.82, 2.4, null],
  ['VNIBOR-1W', 'Interbank 1W', 'rate', 'bank-rates', '% p.a.', 2, 4.08, 1.2, null],
  ['VNIBOR-1M', 'Interbank 1M', 'rate', 'bank-rates', '% p.a.', 2, 4.55, -0.4, null],
  ['VNIBOR-3M', 'Interbank 3M', 'rate', 'bank-rates', '% p.a.', 2, 4.9, 0.2, null],
  // LS huy động 12 tháng trung bình theo nhóm ngân hàng (%/năm) — có lịch sử để vẽ xu hướng
  ['DEP12M-STATE', 'Avg 12M deposit — State', 'deposit', 'bank-rates', '% p.a.', 2, 4.7, 0, null],
  ['DEP12M-PRIVATE', 'Avg 12M deposit — Private', 'deposit', 'bank-rates', '% p.a.', 2, 5.19, 0.39, null],
].map(([symbol, name, assetClass, departmentId, unit, dp, price, changePct, volume]) =>
  ({ symbol, name, assetClass, departmentId, unit, dp, price, changePct, volume }));

// Độ biến động ngày giả lập cho từng loại tài sản
AFA.mock.volatility = { index: 0.009, stock: 0.018, indicator: 0.012, fx: 0.0025, commodity: 0.014, rate: 0.03, deposit: 0.0025 };

/* MOCK lãi suất ngân hàng TMCP (%/năm) — minh họa, KHÔNG phải biểu lãi suất thật.
 * Schema BankRate { bankId, bank, group: 'state'|'private', deposit{kỳ hạn}, lending{loại vay}, source }
 * Schema RateChange { bankId, kind: 'deposit'|'lending', key, from, to, date }
 */
AFA.mock.depositTerms = ['1M', '3M', '6M', '9M', '12M', '18M', '24M', '36M'];
AFA.mock.lendingTypes = [
  { id: 'home', label: 'Mortgage (promo)' },
  { id: 'homeFloat', label: 'Mortgage (floating)' },
  { id: 'business', label: 'Short-term business' },
  { id: 'consumer', label: 'Unsecured consumer' },
];

// [bankId, bank, group, deposit[1M,3M,6M,9M,12M,18M,24M,36M], lending[home, homeFloat, business, consumer]]
AFA.mock.bankRates = [
  ['VCB', 'Vietcombank', 'state', [1.6, 1.9, 2.9, 2.9, 4.6, 4.6, 4.7, 4.7], [5.5, 9.0, 5.2, 11.5]],
  ['BIDV', 'BIDV', 'state', [1.7, 2.0, 3.0, 3.0, 4.7, 4.7, 4.9, 4.9], [5.8, 9.2, 5.4, 12.0]],
  ['CTG', 'VietinBank', 'state', [1.7, 2.0, 3.0, 3.0, 4.7, 4.7, 4.8, 4.8], [5.7, 9.1, 5.3, 12.0]],
  ['AGR', 'Agribank', 'state', [2.1, 2.4, 3.5, 3.5, 4.8, 4.8, 4.8, 4.8], [6.0, 9.3, 5.5, 11.8]],
  ['TCB', 'Techcombank', 'private', [3.3, 3.6, 4.6, 4.6, 4.85, 4.85, 4.85, 4.85], [6.5, 10.5, 6.8, 14.5]],
  ['MBB', 'MB Bank', 'private', [3.5, 3.8, 4.4, 4.4, 4.9, 5.6, 5.6, 5.6], [6.8, 10.2, 6.5, 14.0]],
  ['ACB', 'ACB', 'private', [3.1, 3.5, 4.2, 4.3, 4.9, 4.9, 4.9, 4.9], [6.9, 10.0, 6.6, 13.5]],
  ['VPB', 'VPBank', 'private', [3.7, 3.9, 4.9, 4.9, 5.3, 5.3, 5.3, 5.3], [7.2, 11.0, 7.0, 16.0]],
  ['STB', 'Sacombank', 'private', [3.3, 3.6, 4.9, 4.9, 5.4, 5.6, 5.6, 5.6], [7.5, 10.8, 7.2, 15.0]],
  ['HDB', 'HDBank', 'private', [3.85, 3.95, 5.3, 5.3, 5.6, 6.1, 6.1, 6.1], [7.0, 10.9, 7.1, 15.5]],
  ['VIB', 'VIB', 'private', [3.7, 3.9, 4.8, 4.8, 5.3, 5.4, 5.4, 5.4], [7.3, 10.9, 7.0, 16.5]],
  ['TPB', 'TPBank', 'private', [3.7, 4.0, 4.9, 4.9, 5.4, 5.6, 5.6, 5.6], [7.1, 10.7, 6.9, 15.0]],
  ['SHB', 'SHB', 'private', [3.5, 3.8, 5.0, 5.1, 5.5, 5.8, 5.8, 5.8], [7.4, 11.2, 7.3, 15.5]],
  ['LPB', 'LPBank', 'private', [3.6, 3.9, 5.0, 5.0, 5.4, 5.6, 5.6, 5.6], [7.2, 10.8, 7.0, 15.0]],
  ['MSB', 'MSB', 'private', [3.9, 3.9, 5.0, 5.0, 5.6, 5.6, 5.6, 5.6], [7.5, 11.0, 7.2, 16.0]],
  ['OCB', 'OCB', 'private', [3.9, 4.1, 5.0, 5.0, 5.5, 5.8, 5.9, 5.9], [7.6, 11.2, 7.3, 16.0]],
  ['SSB', 'SeABank', 'private', [2.95, 3.45, 3.95, 4.15, 4.7, 5.45, 5.45, 5.45], [7.0, 10.5, 6.9, 15.0]],
  ['EIB', 'Eximbank', 'private', [3.9, 4.3, 5.2, 4.5, 5.2, 5.1, 5.6, 5.6], [7.3, 10.9, 7.1, 15.5]],
].map(([bankId, bank, group, dep, lend]) => ({
  bankId, bank, group,
  deposit: Object.fromEntries(AFA.mock.depositTerms.map((t, i) => [t, dep[i]])),
  lending: Object.fromEntries(AFA.mock.lendingTypes.map((t, i) => [t.id, lend[i]])),
  source: 'mock',
}));

// Nhật ký điều chỉnh lãi suất: [bankId, kind, key, from, to, ageDays]
AFA.mock.rateChanges = [
  ['HDB', 'deposit', '12M', 5.4, 5.6, 1],
  ['VPB', 'deposit', '12M', 5.1, 5.3, 2],
  ['TPB', 'deposit', '6M', 4.7, 4.9, 3],
  ['SHB', 'deposit', '18M', 5.6, 5.8, 4],
  ['MSB', 'lending', 'home', 7.8, 7.5, 5],
  ['STB', 'deposit', '12M', 5.2, 5.4, 6],
  ['OCB', 'deposit', '24M', 5.7, 5.9, 9],
  ['ACB', 'lending', 'business', 6.8, 6.6, 12],
  ['LPB', 'deposit', '6M', 4.8, 5.0, 15],
  ['MBB', 'deposit', '18M', 5.4, 5.6, 19],
  ['EIB', 'deposit', '9M', 4.7, 4.5, 23],
  ['TCB', 'lending', 'home', 6.8, 6.5, 27],
  ['VIB', 'deposit', '12M', 5.1, 5.3, 34],
  ['SSB', 'deposit', '1M', 3.15, 2.95, 41],
  ['AGR', 'deposit', '12M', 4.7, 4.8, 55],
].map(([bankId, kind, key, from, to, ageDays]) => ({ bankId, kind, key, from, to, ageDays }));

// Lãi suất điều hành NHNN — Schema PolicyRate { id, name, value, prev, unit }
AFA.mock.policyRates = [
  { id: 'refinance', name: 'Refinancing rate', value: 4.5, prev: 4.5, unit: '% p.a.' },
  { id: 'rediscount', name: 'Rediscount rate', value: 3.0, prev: 3.0, unit: '% p.a.' },
  { id: 'omo', name: 'OMO rate (7-day)', value: 4.0, prev: 4.0, unit: '% p.a.' },
  { id: 'cap', name: 'Deposit cap (< 6M)', value: 4.75, prev: 4.75, unit: '% p.a.' },
];
