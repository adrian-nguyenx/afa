/* MOCK news — tin minh họa (không phải tin thật), dùng để dựng giao diện Phase 1.
 * Link trỏ về trang chủ của nguồn, không phải bài viết cụ thể.
 * ageMin: số phút trước thời điểm tải trang (provider sẽ chuyển thành publishedAt ISO).
 */
window.AFA = window.AFA || {};
AFA.mock = AFA.mock || {};

AFA.mock.sources = {
  CafeF: 'https://cafef.vn',
  VnExpress: 'https://vnexpress.net',
  Vietstock: 'https://vietstock.vn',
  VnEconomy: 'https://vneconomy.vn',
  'Báo Chính phủ': 'https://baochinhphu.vn',
  NHNN: 'https://www.sbv.gov.vn',
  'Cục Thống kê': 'https://www.nso.gov.vn',
  HNX: 'https://www.hnx.vn',
  Reuters: 'https://www.reuters.com',
  Bloomberg: 'https://www.bloomberg.com',
  'Financial Times': 'https://www.ft.com',
  CNBC: 'https://www.cnbc.com',
  'Nikkei Asia': 'https://asia.nikkei.com',
  WSJ: 'https://www.wsj.com',
  Kitco: 'https://www.kitco.com',
};

// [departmentId, ageMin, importance(1-3), country, sector, category, source, headline, summary, markets[]]
AFA.mock.news = [
  // Phòng Doanh nghiệp Việt Nam
  ['vn-corporate', 35, 3, 'VN', 'Technology', 'Earnings', 'CafeF', 'FPT báo lãi trước thuế 10 tháng tăng 19%, mảng công nghệ nước ngoài dẫn dắt', 'Doanh thu dịch vụ CNTT nước ngoài tiếp tục là động lực tăng trưởng chính; biên lợi nhuận cải thiện so với cùng kỳ.', ['FPT', 'VNINDEX']],
  ['vn-banks', 90, 2, 'VN', 'Banking', 'Strategy', 'VnExpress', 'Vietcombank đặt mục tiêu tăng trưởng tín dụng 15% cho năm 2027', 'Ngân hàng ưu tiên tín dụng bán lẻ và doanh nghiệp FDI, đồng thời đẩy mạnh chuyển đổi số.', ['VCB']],
  ['vn-corporate', 180, 3, 'VN', 'Real Estate', 'M&A', 'Vietstock', 'Vingroup hoàn tất chuyển nhượng một phần vốn tại dự án khu đô thị phía Đông Hà Nội', 'Giao dịch giúp bổ sung dòng tiền cho các mảng sản xuất và hạ tầng của tập đoàn.', ['VIC']],
  ['vn-corporate', 300, 2, 'VN', 'Industrials', 'Investment', 'CafeF', 'Hòa Phát khởi động giai đoạn mở rộng mới tại khu liên hợp gang thép Dung Quất', 'Dự án dự kiến nâng công suất thép cán nóng, phục vụ nhu cầu nội địa và xuất khẩu.', ['HPG']],
  ['vn-corporate', 420, 2, 'VN', 'Consumer', 'Leadership Change', 'VnEconomy', 'Thế Giới Di Động kiện toàn ban điều hành chuỗi Bách Hóa Xanh', 'Doanh nghiệp công bố thay đổi nhân sự cấp cao nhằm chuẩn bị cho kế hoạch mở rộng chuỗi bán lẻ.', ['MWG']],
  ['vn-corporate', 600, 1, 'VN', 'Consumer', 'Earnings', 'VnEconomy', 'Vinamilk: doanh thu xuất khẩu quý III tăng hai chữ số', 'Thị trường Trung Đông và châu Phi đóng góp tỷ trọng lớn trong tăng trưởng xuất khẩu.', ['VNM']],
  ['vn-banks', 1500, 3, 'VN', 'Banking', 'Corporate Event', 'Vietstock', 'Techcombank công bố kế hoạch phát hành cổ phiếu thưởng tăng vốn điều lệ', 'Kế hoạch cần được đại hội đồng cổ đông thông qua; dự kiến hoàn tất trong nửa đầu năm sau.', ['TCB']],

  // Phòng Doanh nghiệp Quốc tế
  ['global-corporate', 50, 3, 'US', 'Technology', 'Earnings', 'Reuters', 'Nvidia vượt kỳ vọng doanh thu trung tâm dữ liệu, nâng dự báo quý tới', 'Nhu cầu chip AI từ các hyperscaler tiếp tục cao; cổ phiếu tăng mạnh trong giao dịch ngoài giờ.', ['NVDA', 'IXIC']],
  ['global-corporate', 140, 2, 'US', 'Technology', 'Strategy', 'Bloomberg', 'Microsoft mở rộng đầu tư hạ tầng AI tại Đông Nam Á', 'Kế hoạch bao gồm trung tâm dữ liệu mới và chương trình đào tạo kỹ năng số trong khu vực.', ['MSFT']],
  ['global-corporate', 260, 3, 'US', 'Technology', 'M&A', 'Financial Times', 'Alphabet được cho là đàm phán thương vụ mua lại một công ty an ninh mạng', 'Nguồn tin cho biết thương vụ có thể trở thành một trong những vụ M&A lớn nhất ngành năm nay.', ['GOOGL']],
  ['global-corporate', 500, 2, 'JP', 'Industrials', 'Earnings', 'Nikkei Asia', 'Toyota điều chỉnh dự báo lợi nhuận năm tài chính do biến động đồng yên', 'Hãng xe Nhật Bản cho biết chi phí nguyên vật liệu và tỷ giá ảnh hưởng đến biên lợi nhuận.', ['USDJPY']],
  ['global-corporate', 900, 2, 'US', 'Consumer', 'Leadership Change', 'CNBC', 'Tesla công bố thay đổi trong ban điều hành mảng năng lượng', 'Thay đổi nhân sự diễn ra trong bối cảnh công ty tái cơ cấu mảng lưu trữ năng lượng.', ['TSLA']],
  ['global-corporate', 2000, 1, 'EU', 'Energy', 'Investment', 'Reuters', 'Shell tăng chi đầu tư cho các dự án LNG tại châu Á', 'Tập đoàn kỳ vọng nhu cầu khí hóa lỏng tại châu Á tiếp tục tăng trong thập kỷ tới.', ['BRENT', 'NG']],

  // Phòng Vĩ mô Việt Nam
  ['vn-macro', 25, 3, 'VN', 'Monetary Policy', 'Interest Rates', 'NHNN', 'NHNN giữ nguyên lãi suất điều hành, tiếp tục hỗ trợ thanh khoản qua thị trường mở', 'Ngân hàng Nhà nước duy trì mặt bằng lãi suất ổn định để hỗ trợ tăng trưởng kinh tế.', ['VNINDEX', 'USDVND']],
  ['vn-macro', 120, 3, 'VN', 'Fiscal Policy', 'National Assembly', 'VnExpress', 'Quốc hội thảo luận kế hoạch phát triển kinh tế – xã hội năm 2027', 'Các đại biểu tập trung vào mục tiêu tăng trưởng, đầu tư công và cải cách thể chế.', ['VNINDEX']],
  ['vn-macro', 240, 2, 'VN', 'Inflation', 'CPI', 'Cục Thống kê', 'CPI tháng 10 tăng nhẹ so với tháng trước, lạm phát cơ bản ổn định', 'Nhóm nhà ở, vật liệu xây dựng và giáo dục là các yếu tố chính tác động đến chỉ số giá.', []],
  ['vn-macro', 480, 2, 'VN', 'Trade', 'Trade', 'VnEconomy', 'Kim ngạch xuất khẩu 10 tháng ước đạt mức cao, cán cân thương mại tiếp tục thặng dư', 'Điện tử, máy móc và nông sản là các nhóm hàng đóng góp lớn nhất.', ['USDVND']],
  ['vn-macro', 700, 2, 'VN', 'FX', 'Exchange Rate', 'CafeF', 'NHNN điều chỉnh tỷ giá trung tâm tăng nhẹ', 'Động thái phản ánh diễn biến đồng USD trên thị trường quốc tế.', ['USDVND']],
  ['vn-macro', 1300, 1, 'VN', 'Fiscal Policy', 'Government', 'Báo Chính phủ', 'Chính phủ yêu cầu đẩy nhanh giải ngân vốn đầu tư công những tháng cuối năm', 'Các bộ, ngành và địa phương được giao rà soát tiến độ dự án trọng điểm.', []],
  ['vn-macro', 2600, 2, 'VN', 'Growth', 'GDP', 'VnExpress', 'Các tổ chức quốc tế nâng dự báo tăng trưởng GDP Việt Nam', 'Xuất khẩu phục hồi và dòng vốn FDI ổn định là cơ sở cho triển vọng tích cực.', ['VNINDEX']],

  // Phòng Vĩ mô Thế giới
  ['global-macro', 15, 3, 'US', 'Monetary Policy', 'FED', 'Reuters', 'Biên bản FOMC: nhiều thành viên ủng hộ thận trọng với lộ trình cắt giảm lãi suất', 'Thị trường điều chỉnh kỳ vọng về số lần giảm lãi suất trong năm tới.', ['SPX', 'US10Y', 'DXY']],
  ['global-macro', 100, 3, 'GLOBAL', 'Geopolitics', 'Geopolitics', 'Bloomberg', 'Căng thẳng tại Trung Đông đẩy giá dầu tăng, nhà đầu tư tìm đến tài sản trú ẩn', 'Giá vàng và dầu cùng tăng trong khi các chỉ số chứng khoán châu Âu giảm nhẹ.', ['BRENT', 'XAUUSD']],
  ['global-macro', 200, 2, 'EU', 'Monetary Policy', 'ECB', 'Financial Times', 'ECB phát tín hiệu duy trì lãi suất trong quý tới', 'Lạm phát khu vực đồng euro tiệm cận mục tiêu nhưng tăng trưởng còn yếu.', ['EURUSD']],
  ['global-macro', 350, 2, 'JP', 'Monetary Policy', 'BOJ', 'Nikkei Asia', 'BOJ cân nhắc nâng lãi suất trong bối cảnh đồng yên suy yếu', 'Giới phân tích cho rằng quyết định sẽ phụ thuộc vào dữ liệu tiền lương và lạm phát.', ['USDJPY', 'JPYVND']],
  ['global-macro', 550, 3, 'US', 'Inflation', 'CPI', 'CNBC', 'CPI Mỹ tháng 10 cao hơn dự báo, lợi suất trái phiếu 10 năm tăng', 'Lạm phát dịch vụ duy trì ở mức cao khiến thị trường lo ngại về lộ trình chính sách của FED.', ['US10Y', 'SPX']],
  ['global-macro', 1100, 2, 'CN', 'Growth', 'Economic Policy', 'Reuters', 'Trung Quốc công bố gói kích thích tiêu dùng mới', 'Gói hỗ trợ tập trung vào trợ cấp đổi mới hàng tiêu dùng và hỗ trợ thị trường nhà ở.', ['HG']],
  ['global-macro', 3000, 1, 'GLOBAL', 'Trade', 'Economic Policy', 'WSJ', 'Mỹ và EU nối lại đàm phán về thuế quan', 'Hai bên hướng tới khung thỏa thuận cho các mặt hàng công nghiệp và nông sản.', ['EURUSD']],

  // Phòng Chứng khoán Việt Nam
  ['vn-equities', 10, 3, 'VN', 'Equities', 'Market Moves', 'Vietstock', 'VN-Index vượt 1.650 điểm, thanh khoản HOSE trên 21.000 tỷ đồng', 'Nhóm ngân hàng và bất động sản dẫn dắt đà tăng; độ rộng thị trường nghiêng về bên mua.', ['VNINDEX', 'VN30']],
  ['vn-equities', 160, 2, 'VN', 'Equities', 'Foreign Flows', 'CafeF', 'Khối ngoại mua ròng phiên thứ ba liên tiếp, tập trung nhóm ngân hàng', 'Dòng vốn ngoại quay lại sau chuỗi bán ròng kéo dài, ưu tiên cổ phiếu vốn hóa lớn.', ['VCB', 'TCB']],
  ['vn-equities', 400, 2, 'VN', 'Equities', 'Market Moves', 'VnEconomy', 'Cổ phiếu chứng khoán tăng mạnh nhờ kỳ vọng nâng hạng thị trường', 'SSI và nhiều mã cùng ngành tăng trên 4% với thanh khoản đột biến.', ['SSI']],
  ['vn-equities', 1700, 1, 'VN', 'Equities', 'Market Moves', 'HNX', 'HNX-Index và UPCoM giao dịch giằng co, dòng tiền phân hóa', 'Thanh khoản hai sàn ở mức trung bình, nhóm cổ phiếu xây dựng thu hút dòng tiền.', ['HNXINDEX', 'UPCOM']],

  // Phòng Chứng khoán Mỹ
  ['us-equities', 30, 3, 'US', 'Equities', 'Market Moves', 'CNBC', 'S&P 500 và Nasdaq lập đỉnh mới nhờ nhóm công nghệ', 'Cổ phiếu bán dẫn và AI tăng mạnh sau báo cáo lợi nhuận tích cực.', ['SPX', 'IXIC', 'NVDA']],
  ['us-equities', 330, 2, 'US', 'Equities', 'Market Indicators', 'Bloomberg', 'Chỉ số biến động VIX giảm xuống mức thấp nhất 3 tháng', 'Tâm lý thị trường cải thiện khi rủi ro vĩ mô ngắn hạn hạ nhiệt.', ['VIX']],
  ['us-equities', 1400, 1, 'US', 'Equities', 'Market Moves', 'WSJ', 'Dow Jones chịu áp lực từ nhóm cổ phiếu công nghiệp', 'Lo ngại chi phí đầu vào khiến nhiều mã công nghiệp điều chỉnh.', ['DJI']],

  // Phòng Tỷ giá
  ['fx', 60, 2, 'VN', 'FX', 'Exchange Rate', 'CafeF', 'Giá USD tại ngân hàng thương mại tăng nhẹ, giao dịch quanh 26.350 VND', 'Tỷ giá niêm yết tại các ngân hàng lớn nhích lên theo diễn biến DXY.', ['USDVND']],
  ['fx', 450, 2, 'JP', 'FX', 'Exchange Rate', 'Reuters', 'Đồng yên chạm mức yếu nhất nhiều tháng so với USD', 'Chênh lệch lợi suất Mỹ – Nhật tiếp tục gây áp lực lên đồng yên.', ['USDJPY', 'JPYVND']],
  ['fx', 1600, 1, 'EU', 'FX', 'Exchange Rate', 'Bloomberg', 'EUR/USD đi ngang trước dữ liệu PMI khu vực đồng euro', 'Nhà đầu tư chờ tín hiệu mới về sức khỏe khu vực sản xuất châu Âu.', ['EURUSD', 'EURVND']],

  // Ban Ngân hàng — Phòng Lãi suất
  ['bank-rates', 45, 3, 'VN', 'Banking', 'Deposit Rates', 'CafeF', 'Nhiều ngân hàng tư nhân tăng lãi suất huy động kỳ hạn 12 tháng thêm 0,1–0,3 điểm %', 'Áp lực huy động vốn cuối năm khiến nhóm ngân hàng tư nhân điều chỉnh biểu lãi suất, trong khi nhóm quốc doanh giữ nguyên.', ['VNIBOR-1M']],
  ['bank-rates', 280, 2, 'VN', 'Banking', 'Interbank Rates', 'Vietstock', 'Lãi suất liên ngân hàng qua đêm tăng trở lại quanh 3,8%', 'Thanh khoản hệ thống ngân hàng bớt dồi dào hơn khi nhu cầu tín dụng tăng cao vào cuối năm.', ['VNIBOR-ON', 'VNIBOR-1W']],
  ['bank-rates', 900, 2, 'VN', 'Banking', 'Lending Rates', 'VnExpress', 'Các ngân hàng tung gói vay mua nhà ưu đãi lãi suất cố định năm đầu', 'Lãi suất ưu đãi phổ biến từ 5,5–7%/năm, sau đó thả nổi theo lãi suất tiết kiệm cộng biên độ.', []],
  ['bank-rates', 2200, 1, 'VN', 'Banking', 'Deposit Rates', 'VnEconomy', 'Chênh lệch lãi suất huy động giữa nhóm quốc doanh và tư nhân nới rộng', 'Lãi suất kỳ hạn 12 tháng tại nhóm tư nhân cao hơn nhóm quốc doanh khoảng 0,5–1 điểm %.', []],

  // Ban Ngân hàng — Phòng Ngân hàng Việt Nam
  ['vn-banks', 70, 3, 'VN', 'Banking', 'Earnings', 'CafeF', 'Lợi nhuận 9 tháng của nhóm ngân hàng niêm yết tăng khoảng 15%, phân hóa mạnh', 'Nhóm ngân hàng tư nhân quy mô vừa tăng trưởng nhanh, trong khi một số ngân hàng lớn chịu áp lực trích lập dự phòng.', ['VCB', 'MBB', 'HDB']],
  ['vn-banks', 210, 3, 'VN', 'Banking', 'Credit Growth', 'NHNN', 'Tín dụng toàn hệ thống tăng hơn 13% tính từ đầu năm', 'NHNN cho biết tín dụng tập trung vào sản xuất kinh doanh và các lĩnh vực ưu tiên; dư địa còn lại cho những tháng cuối năm.', []],
  ['vn-banks', 380, 2, 'VN', 'Banking', 'Asset Quality', 'Vietstock', 'Nợ xấu nội bảng nhích nhẹ, tỷ lệ bao phủ nợ xấu giảm tại nhiều ngân hàng', 'Các ngân hàng tăng cường xử lý nợ và bán tài sản bảo đảm nhằm cải thiện chất lượng tài sản.', ['VPB', 'STB']],
  ['vn-banks', 640, 2, 'VN', 'Banking', 'CASA', 'VnEconomy', 'Tỷ lệ CASA phục hồi nhờ thanh toán số, MB và Techcombank dẫn đầu', 'Tiền gửi không kỳ hạn tăng giúp giảm chi phí vốn và hỗ trợ biên lãi ròng.', ['MBB', 'TCB']],
  ['vn-banks', 1250, 2, 'VN', 'Banking', 'CAR', 'CafeF', 'Nhiều ngân hàng lên kế hoạch tăng vốn để nâng hệ số an toàn vốn', 'Phương án gồm chia cổ tức bằng cổ phiếu, phát hành riêng lẻ và trái phiếu tăng vốn cấp 2.', ['BID', 'CTG']],

  // Phòng Hàng hóa
  ['commodities', 20, 3, 'GLOBAL', 'Commodities', 'Gold', 'Reuters', 'Giá vàng thế giới tăng, tiến sát vùng 4.000 USD/ounce', 'Nhu cầu trú ẩn và hoạt động mua của các ngân hàng trung ương hỗ trợ giá vàng.', ['XAUUSD']],
  ['commodities', 220, 2, 'GLOBAL', 'Commodities', 'Oil', 'Bloomberg', 'Giá dầu Brent tăng hơn 1% sau báo cáo tồn kho của Mỹ', 'Tồn kho dầu thô giảm mạnh hơn dự báo, củng cố kỳ vọng thắt chặt nguồn cung.', ['BRENT', 'WTI']],
  ['commodities', 260, 2, 'VN', 'Commodities', 'Gold', 'VnExpress', 'Giá vàng miếng trong nước điều chỉnh theo xu hướng thế giới', 'Chênh lệch giữa giá vàng trong nước và thế giới tiếp tục được theo dõi sát.', ['XAUUSD']],
  ['commodities', 800, 1, 'GLOBAL', 'Commodities', 'Silver', 'Kitco', 'Giá bạc biến động mạnh theo nhu cầu công nghiệp', 'Nhu cầu từ ngành pin mặt trời và điện tử tiếp tục là yếu tố hỗ trợ dài hạn.', ['XAGUSD']],
];
