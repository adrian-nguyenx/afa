/* Registry — organisation structure: Divisions → Departments.
 * Each department maps to a future AI agent (agentId).
 * Add a division/department by adding an entry here; navigation, routing and pages update automatically.
 */
window.AFA = window.AFA || {};

(function () {
  const divisions = [
    {
      id: 'corporate',
      code: '01',
      color: '#00e5ff',
      name: 'Corporate Division',
      nameEn: 'Corporate Intelligence',
      status: 'active',
      description: 'Tracks news, strategy, earnings, M&A and corporate events of domestic and international companies.',
      departments: [
        {
          id: 'vn-corporate',
          name: 'Vietnam Corporate',
          nameEn: 'Vietnam Corporate Desk',
          aiProfile: 'news',
          agentId: 'agent.corporate.vn',
          country: 'VN',
          description: 'Aggregates news and events that may affect the operations or value of Vietnamese companies.',
          scope: ['Corporate news', 'Business activities & strategy', 'Earnings', 'M&A & investments', 'Leadership changes', 'Key corporate events', 'Value-moving information'],
        },
        {
          id: 'global-corporate',
          name: 'Global Corporate',
          nameEn: 'Global Corporate Desk',
          aiProfile: 'news',
          agentId: 'agent.corporate.global',
          country: 'GLOBAL',
          description: 'Tracks international corporations whose activities move global markets.',
          scope: ['Global corporate news', 'Business activities & corporate strategy', 'Earnings', 'M&A & investments', 'Leadership changes', 'Market-moving corporate events'],
        },
      ],
    },
    {
      id: 'macro',
      code: '02',
      color: '#8b5cff',
      name: 'Macroeconomic Division',
      nameEn: 'Macroeconomic Intelligence',
      status: 'active',
      description: 'Tracks policy, economic indicators and macro events in Vietnam and worldwide.',
      departments: [
        {
          id: 'vn-macro',
          name: 'Vietnam Macro',
          nameEn: 'Vietnam Macro Desk',
          aiProfile: 'news',
          agentId: 'agent.macro.vn',
          country: 'VN',
          description: 'Tracks the National Assembly, the Government, the State Bank of Vietnam and key macro indicators.',
          scope: ['National Assembly', 'Government', 'State Bank of Vietnam', 'Monetary policy', 'Fiscal policy', 'Policy rates', 'Inflation', 'GDP', 'Exchange rate', 'Exports & imports', 'Economic policy'],
        },
        {
          id: 'global-macro',
          name: 'Global Macro',
          nameEn: 'Global Macro Desk',
          aiProfile: 'news',
          agentId: 'agent.macro.global',
          country: 'GLOBAL',
          description: 'Tracks the Fed, major central banks, geopolitics and global economic indicators.',
          scope: ['Fed', 'ECB / BOJ / major central banks', 'US & major economies policy', 'Political events', 'Geopolitics & conflicts', 'Oil prices', 'Gold prices', 'Global inflation & rates', 'Key economic indicators'],
        },
      ],
    },
    {
      id: 'market',
      code: '03',
      color: '#3dffb5',
      name: 'Market Monitoring Division',
      nameEn: 'Market Monitoring',
      status: 'active',
      description: 'Monitors prices and moves across equities, FX and commodities.',
      departments: [
        {
          id: 'vn-equities',
          name: 'Vietnam Equities',
          nameEn: 'Vietnam Equities Desk',
          aiProfile: 'market',
          agentId: 'agent.market.vn-equities',
          country: 'VN',
          description: 'Tracks indices, stock prices, volume and liquidity on the Vietnamese stock market.',
          scope: ['VN-Index', 'HNX-Index', 'UPCOM', 'Stock prices', '% change', 'Trading volume', 'Liquidity', 'Notable stocks'],
          symbols: ['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOM', 'FPT', 'HPG', 'VIC', 'VNM', 'MWG', 'SSI'],
          chartSymbols: ['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOM'],
        },
        {
          id: 'us-equities',
          name: 'US Equities',
          nameEn: 'US Equities Desk',
          aiProfile: 'market',
          agentId: 'agent.market.us-equities',
          country: 'US',
          description: 'Tracks major US indices, mega-cap stocks and key market indicators.',
          scope: ['S&P 500', 'Nasdaq', 'Dow Jones', 'Mega-cap stocks', 'Prices & volatility', 'Market indicators'],
          symbols: ['SPX', 'IXIC', 'DJI', 'VIX', 'US10Y', 'DXY', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA'],
          chartSymbols: ['SPX', 'IXIC', 'DJI', 'NVDA'],
        },
        {
          id: 'fx',
          name: 'Foreign Exchange',
          nameEn: 'FX Desk',
          aiProfile: 'market',
          agentId: 'agent.market.fx',
          country: 'GLOBAL',
          description: 'Tracks VND exchange rates and other key currency pairs.',
          scope: ['USD/VND', 'EUR/VND', 'JPY/VND', 'Other key pairs', 'FX volatility'],
          symbols: ['USDVND', 'EURVND', 'JPYVND', 'CNYVND', 'GBPVND', 'EURUSD', 'USDJPY', 'DXY'],
          chartSymbols: ['USDVND', 'EURVND', 'JPYVND', 'EURUSD'],
        },
        {
          id: 'commodities',
          name: 'Commodities',
          nameEn: 'Commodities Desk',
          aiProfile: 'market',
          agentId: 'agent.market.commodities',
          country: 'GLOBAL',
          description: 'Tracks gold, silver, oil and other key commodities.',
          scope: ['Gold', 'Silver', 'Oil', 'Other key commodities', 'Price moves & trends'],
          symbols: ['XAUUSD', 'XAGUSD', 'WTI', 'BRENT', 'NG', 'HG'],
          chartSymbols: ['XAUUSD', 'XAGUSD', 'WTI', 'BRENT'],
        },
      ],
    },
    {
      id: 'banking',
      code: '04',
      color: '#ff3ec9',
      name: 'Banking Division',
      nameEn: 'Banking Intelligence',
      status: 'active',
      description: 'Tracks interest rates, financial health and news of the Vietnamese banking system.',
      departments: [
        {
          id: 'bank-rates',
          name: 'Interest Rates',
          nameEn: 'Interest Rates Desk',
          aiProfile: 'rates',
          agentId: 'agent.banking.rates',
          country: 'VN',
          description: 'Tracks deposit and lending rates, compares banks, follows rate trends and promotional rate programmes.',
          scope: ['Deposit rates', 'Lending rates', 'Deposit rates by term', 'Lending rates by product', 'Bank-by-bank comparison', 'Rate trends', 'Promotional rate programmes'],
          // Department-specific feature blocks (views/pages.js → AFA.ui.features)
          features: ['bankRates'],
          symbols: ['DEP12M-STATE', 'DEP12M-PRIVATE', 'VNIBOR-ON', 'VNIBOR-1W', 'VNIBOR-1M', 'VNIBOR-3M'],
          chartSymbols: ['DEP12M-STATE', 'DEP12M-PRIVATE', 'VNIBOR-ON', 'VNIBOR-1M'],
          chartTitle: 'Rate trends',
          tableTitle: 'Market rates',
        },
        {
          id: 'vn-banks',
          name: 'Vietnam Banks',
          nameEn: 'Vietnam Banks Desk',
          aiProfile: 'banking',
          agentId: 'agent.banking.vn-banks',
          country: 'VN',
          description: 'Tracks news, earnings and financial metrics of the major banks in Vietnam.',
          scope: ['Banking news', 'Earnings', 'Credit growth', 'Deposits', 'NIM', 'CASA', 'NPL', 'CAR', 'ROE/ROA', 'Total assets', 'Loan book', 'Asset quality'],
          features: ['bankFundamentals'],
          symbols: ['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'STB', 'HDB'],
          chartSymbols: ['VCB', 'BID', 'TCB', 'MBB'],
          chartTitle: 'Bank stocks',
          tableTitle: 'Bank stock prices',
        },
      ],
    },
    {
      id: 'investment',
      code: '05',
      color: '#ffc857',
      name: 'Investment Division',
      nameEn: 'Investment Intelligence',
      status: 'coming-soon',
      plannedPhase: 5,
      description: 'A separate development stage — it starts only after the website officially goes live.',
      departments: [
        { id: 'strategy', name: 'Investment Strategy', nameEn: 'Strategy Desk', description: 'Paper-trading simulation: watchlist, portfolio, simulated buy/sell, P&L.' },
        { id: 'research', name: 'Research', nameEn: 'Research Desk', description: 'Collects and classifies research reports from brokerages and financial institutions.' },
        { id: 'analysis', name: 'Financial Analysis', nameEn: 'Analysis Desk', description: 'Financial statements, modelling, valuation, ratios and peer comparison.' },
      ],
    },
  ];

  /* Agent identity layer — display names only. Technical agentId, aiProfile, data and workflows are unchanged.
   * Names are kept in this one table so they can be swapped easily (e.g. before a public go-live). */
  const AGENTS = {
    'vn-corporate':     { name: 'Jessica Drew', alias: 'Spider-Woman', code: 'JESSICA-01', title: 'Vietnam Corporate Intelligence Agent', persona: 'Seasoned investigator — digs into filings, deals and leadership moves.' },
    'global-corporate': { name: 'Miles Morales', alias: 'Spider-Man', code: 'MILES-02', title: 'Global Corporate Intelligence Agent', persona: 'Fast and adaptable — tracks global earnings, M&A and corporate strategy.' },
    'vn-macro':         { name: 'Pavitr Prabhakar', alias: 'Spider-Man India', code: 'PAVITR-03', title: 'Vietnam Macroeconomic Intelligence Agent', persona: 'Home-market specialist — reads policy, CPI, GDP and trade flows.' },
    'global-macro':     { name: "Miguel O'Hara", alias: 'Spider-Man 2099', code: 'MIGUEL-04', title: 'Global Macroeconomic Intelligence Agent', persona: 'Systems thinker from the future — watches central banks and geopolitics.' },
    'vn-equities':      { name: 'Gwen Stacy', alias: 'Ghost-Spider', code: 'GWEN-05', title: 'Vietnam Market Monitoring Agent', persona: 'Lightning reflexes — monitors VN-Index, liquidity and notable stocks.' },
    'us-equities':      { name: 'Mayday Parker', alias: 'Spider-Girl', code: 'MAYDAY-06', title: 'US Market Monitoring Agent', persona: 'Next-generation instincts — follows Wall Street indices and mega-caps.' },
    'fx':               { name: 'Hobie Brown', alias: 'Spider-Punk', code: 'HOBIE-07', title: 'FX Monitoring Agent', persona: 'Borderless and restless — tracks currencies and cross-border flows.' },
    'commodities':      { name: 'Spider-Man Noir', alias: 'Peter Parker (Noir)', code: 'NOIR-08', title: 'Commodities Monitoring Agent', persona: 'Old-school and patient — watches gold, oil and hard assets.' },
    'bank-rates':       { name: 'Cindy Moon', alias: 'Silk', code: 'CINDY-09', title: 'Interest Rates Intelligence Agent', persona: 'Photographic memory — catches every deposit and lending rate change.' },
    'vn-banks':         { name: 'Peter Parker', alias: 'Spider-Man', code: 'PETER-10', title: 'Banking Intelligence Agent', persona: 'Scientist-analyst — studies bank balance sheets, NIM, NPL and CAR.' },
  };

  // Back-reference from each department to its division + attach the agent identity (fallback for new desks)
  divisions.forEach(d => d.departments.forEach(p => {
    p.divisionId = d.id;
    if (p.agentId) p.agent = AGENTS[p.id] || { name: p.nameEn, alias: '', code: p.id.toUpperCase(), title: `${p.name} Agent`, persona: p.description };
  }));

  const taxonomy = {
    countries: {
      VN: 'Vietnam', US: 'United States', EU: 'Europe', JP: 'Japan', CN: 'China', GLOBAL: 'Global',
    },
    importance: {
      3: { label: 'High', key: 'high' },
      2: { label: 'Medium', key: 'med' },
      1: { label: 'Low', key: 'low' },
    },
    timeRanges: [
      { v: 'all', l: 'All time' },
      { v: '1h', l: 'Last hour' },
      { v: '24h', l: 'Last 24 hours' },
      { v: '7d', l: 'Last 7 days' },
      { v: '30d', l: 'Last 30 days' },
    ],
  };

  AFA.registry = {
    divisions,
    taxonomy,
    activeDivisions: () => divisions.filter(d => d.status === 'active'),
    getDivision: id => divisions.find(d => d.id === id) || null,
    getDepartment: id => {
      for (const d of divisions) {
        const p = d.departments.find(x => x.id === id);
        if (p) return p;
      }
      return null;
    },
    allDepartments: () => divisions.filter(d => d.status === 'active').flatMap(d => d.departments),
    countryLabel: c => taxonomy.countries[c] || c,
    deptHref: id => {
      const p = AFA.registry.getDepartment(id);
      return p ? `#/${p.divisionId}/${p.id}` : '#/';
    },
  };
})();
