import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as echarts from 'echarts';

// ─── 공통 상수 ───
const PAGE_W = 297; // A4 가로 mm
const PAGE_H = 210;
const MARGIN = 12;
const USABLE_W = PAGE_W - MARGIN * 2;

const FONT_NAME = 'MalgunGothic';
// 폰트 데이터 캐시 (fetch는 1회만, 매 PDF 인스턴스에 등록)
let cachedFontData = null;

const COLORS = {
  title: '#1e293b',
  subtitle: '#64748b',
  label: '#475569',
  value: '#1e293b',
  muted: '#94a3b8',
  border: '#e2e8f0',
  bgCard: '#f1f5f9',
  white: '#ffffff',
  accent: '#6366f1',
  critical: '#ef4444',
  major: '#f97316',
  minor: '#eab308',
  warning: '#3b82f6',
  success: '#10b981',
};

// ─── 한글 폰트 로드 ───

async function loadKoreanFont(pdf) {
  try {
    // 폰트 데이터 fetch (1회만)
    if (!cachedFontData) {
      const toBase64 = (buf) => {
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      };

      const [regularBuf, boldBuf] = await Promise.all([
        fetch('/fonts/malgun.ttf').then(r => r.arrayBuffer()),
        fetch('/fonts/malgunbd.ttf').then(r => r.arrayBuffer()),
      ]);

      cachedFontData = {
        regular: toBase64(regularBuf),
        bold: toBase64(boldBuf),
      };
    }

    // 매 PDF 인스턴스에 폰트 등록
    pdf.addFileToVFS('malgun.ttf', cachedFontData.regular);
    pdf.addFont('malgun.ttf', FONT_NAME, 'normal');
    pdf.addFileToVFS('malgunbd.ttf', cachedFontData.bold);
    pdf.addFont('malgunbd.ttf', FONT_NAME, 'bold');
    pdf.setFont(FONT_NAME, 'normal');
  } catch (e) {
    console.warn('한글 폰트 로드 실패, 기본 폰트 사용:', e);
    pdf.setFont('helvetica', 'normal');
  }
}

// ─── 오프스크린 ECharts 렌더링 ───

function toLightTheme(option) {
  const light = JSON.parse(JSON.stringify(option, (key, val) => {
    if (typeof val === 'function') return undefined;
    return val;
  }));

  const fixAxis = (axis) => {
    if (!axis) return;
    if (axis.axisLabel) axis.axisLabel.color = '#475569';
    if (axis.axisLine?.lineStyle) axis.axisLine.lineStyle.color = '#cbd5e1';
    if (axis.splitLine?.lineStyle) axis.splitLine.lineStyle.color = '#e2e8f0';
  };
  fixAxis(light.xAxis);
  fixAxis(light.yAxis);

  if (light.legend?.textStyle) light.legend.textStyle.color = '#475569';

  (light.series || []).forEach(s => {
    if (s.label?.color === '#e2e8f0') s.label.color = '#334155';
    if (s.label?.color === '#94a3b8') s.label.color = '#475569';
  });

  light.backgroundColor = '#ffffff';
  light.animation = false;

  return light;
}

export function renderChartToImage(option, width = 560, height = 280) {
  if (!option || !option.series) return null;

  const div = document.createElement('div');
  div.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
  div.style.width = width + 'px';
  div.style.height = height + 'px';
  document.body.appendChild(div);

  try {
    const chart = echarts.init(div, null, { width, height, renderer: 'canvas' });
    const lightOption = toLightTheme(option);
    chart.setOption(lightOption);
    const dataUrl = chart.getDataURL({ type: 'png', pixelRatio: 2 });
    chart.dispose();
    return dataUrl;
  } catch (e) {
    console.error('Chart render failed:', e);
    return null;
  } finally {
    document.body.removeChild(div);
  }
}

// ─── PDF 공통 유틸 ───

function setFont(pdf, style = 'normal', size = 9) {
  pdf.setFont(FONT_NAME, style);
  pdf.setFontSize(size);
}

function addHeader(pdf, title, subtitle) {
  let y = MARGIN;
  pdf.setFillColor(COLORS.accent);
  pdf.rect(MARGIN, y, 4, 16, 'F');

  setFont(pdf, 'bold', 18);
  pdf.setTextColor(COLORS.title);
  pdf.text(title, MARGIN + 10, y + 7);

  setFont(pdf, 'normal', 9);
  pdf.setTextColor(COLORS.subtitle);
  pdf.text(subtitle, MARGIN + 10, y + 14);

  // 생성일시
  const now = new Date();
  const gen = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  setFont(pdf, 'normal', 8);
  pdf.setTextColor(COLORS.muted);
  pdf.text(`생성일시: ${gen}`, PAGE_W - MARGIN, y + 14, { align: 'right' });

  return y + 22;
}

function addSummaryCards(pdf, cards, y) {
  const cardW = (USABLE_W - (cards.length - 1) * 4) / cards.length;
  const cardH = 22;

  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardW + 4);

    pdf.setFillColor(COLORS.bgCard);
    pdf.roundedRect(x, y, cardW, cardH, 3, 3, 'F');

    if (card.color) {
      pdf.setFillColor(card.color);
      pdf.roundedRect(x, y, 3, cardH, 1.5, 1.5, 'F');
    }

    setFont(pdf, 'normal', 7);
    pdf.setTextColor(COLORS.label);
    pdf.text(card.label, x + (card.color ? 7 : 4), y + 8);

    setFont(pdf, 'bold', 12);
    pdf.setTextColor(card.valueColor || COLORS.value);
    pdf.text(String(card.value), x + (card.color ? 7 : 4), y + 17);
  });

  return y + cardH + 6;
}

function addChartImage(pdf, dataUrl, x, y, w, h) {
  if (!dataUrl) return y;
  pdf.addImage(dataUrl, 'PNG', x, y, w, h);
  return y + h;
}

function addSectionTitle(pdf, title, y) {
  setFont(pdf, 'bold', 11);
  pdf.setTextColor(COLORS.title);
  pdf.text(title, MARGIN, y + 4);
  pdf.setDrawColor(COLORS.border);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, y + 7, PAGE_W - MARGIN, y + 7);
  return y + 12;
}

function checkPageBreak(pdf, neededHeight, currentY) {
  if (currentY + neededHeight > PAGE_H - MARGIN) {
    pdf.addPage();
    return MARGIN;
  }
  return currentY;
}

// ─── 장애통계 리포트 ───

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

export function buildFaultReport(pdf, { chartOptions, reportData }) {
  const { levelCounts, totalActive, avgMttr, agingData, topDevices, summaryByType, period } = reportData;
  const periodStr = period.isToday
    ? `${period.startDate} (당일)`
    : `${period.startDate} ~ ${period.endDate}`;

  // ── Page 1 ──
  let y = addHeader(pdf, '장애 통계 리포트', `조회 기간: ${periodStr}`);

  // 요약 카드
  y = addSummaryCards(pdf, [
    { label: '전체 활성', value: totalActive, color: COLORS.accent, valueColor: COLORS.accent },
    { label: 'Critical', value: levelCounts.C, color: COLORS.critical, valueColor: COLORS.critical },
    { label: 'Major', value: levelCounts.M, color: COLORS.major, valueColor: COLORS.major },
    { label: 'Minor', value: levelCounts.N, color: COLORS.minor, valueColor: COLORS.minor },
    { label: 'Warning', value: levelCounts.W, color: COLORS.warning, valueColor: COLORS.warning },
    { label: '평균 MTTR', value: formatDuration(avgMttr), color: COLORS.muted },
  ], y);

  const chartH = 72;
  const halfW = (USABLE_W - 6) / 2;

  // 유형별 현황 + 발생/해소 추이
  y = addSectionTitle(pdf, '유형별 현황 / 발생·해소 추이', y);

  const donutImg = renderChartToImage(chartOptions.typeDonut, 480, 280);
  const trendImg = renderChartToImage(chartOptions.trendChart, 560, 280);

  addChartImage(pdf, donutImg, MARGIN, y, halfW, chartH);
  addChartImage(pdf, trendImg, MARGIN + halfW + 6, y, halfW, chartH);
  y += chartH + 6;

  // ── 유형별 추이 + MTTR ──
  y = checkPageBreak(pdf, 90, y);
  y = addSectionTitle(pdf, '유형별 발생 추이 / 평균 처리시간(MTTR)', y);

  const typeTrendImg = renderChartToImage(chartOptions.typeTrend, 560, 280);
  const mttrImg = renderChartToImage(chartOptions.mttrChart, 480, 280);

  addChartImage(pdf, typeTrendImg, MARGIN, y, halfW, chartH);
  addChartImage(pdf, mttrImg, MARGIN + halfW + 6, y, halfW, chartH);
  y += chartH + 6;

  // 시간대별 / 요일별 패턴
  y = checkPageBreak(pdf, 90, y);
  y = addSectionTitle(pdf, '시간대별 분포 / 요일별 분포', y);

  const hourImg = renderChartToImage(chartOptions.hourPattern, 560, 260);
  const dowImg = renderChartToImage(chartOptions.dowPattern, 560, 260);

  addChartImage(pdf, hourImg, MARGIN, y, halfW, chartH);
  addChartImage(pdf, dowImg, MARGIN + halfW + 6, y, halfW, chartH);
  y += chartH + 6;

  // ── Aging + Top Devices ──
  y = checkPageBreak(pdf, 60, y);
  y = addSectionTitle(pdf, '미해소 장애 Aging 분포', y);

  if (agingData && agingData.length > 0) {
    const agingTotal = agingData.reduce((s, a) => s + a.count, 0) || 1;
    agingData.forEach(item => {
      setFont(pdf, 'normal', 8);
      pdf.setTextColor(COLORS.label);
      pdf.text(item.label, MARGIN + 2, y + 4);

      const barX = MARGIN + 45;
      const barW = USABLE_W - 70;
      pdf.setFillColor('#e2e8f0');
      pdf.roundedRect(barX, y, barW, 5, 2, 2, 'F');

      const fillW = Math.max((item.count / agingTotal) * barW, 2);
      pdf.setFillColor(item.color);
      pdf.roundedRect(barX, y, fillW, 5, 2, 2, 'F');

      setFont(pdf, 'bold', 8);
      pdf.setTextColor(item.color);
      pdf.text(String(item.count), PAGE_W - MARGIN - 2, y + 4, { align: 'right' });

      y += 8;
    });
    y += 4;
  }

  // 상습 장애 장비 Top 10
  y = checkPageBreak(pdf, 50, y);
  y = addSectionTitle(pdf, '상습 장애 장비 Top 10', y);

  if (topDevices && topDevices.length > 0) {
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['#', '장비명', 'IP', '그룹', '총 건수', '활성']],
      body: topDevices.map((d, i) => [
        i + 1,
        d.DEVICE_NAME || '-',
        d.DEVICE_IP || '-',
        d.GROUP_NAME || '-',
        Number(d.TOTAL_CNT),
        Number(d.ACTIVE_CNT),
      ]),
      styles: {
        font: FONT_NAME,
        fontSize: 8,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 7,
      },
      bodyStyles: {
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 18 },
      },
    });
  }
}

// ─── 성능통계 리포트 ───

export function buildPerfReport(pdf, { chartOptions, reportData }) {
  const { summary, highLoadDevices, portTrafficMetrics, period } = reportData;
  const periodStr = period?.label || '';

  // ── Page 1 ──
  let y = addHeader(pdf, '성능 통계 리포트', `조회 기간: ${periodStr}`);

  // 요약 카드
  y = addSummaryCards(pdf, [
    { label: '장비 수', value: summary.count, color: COLORS.accent, valueColor: COLORS.accent },
    { label: '평균 CPU', value: `${summary.avgCpu}%`, color: '#3b82f6', valueColor: '#3b82f6' },
    { label: '평균 MEM', value: `${summary.avgMem}%`, color: COLORS.success, valueColor: COLORS.success },
    { label: '최고 CPU', value: `${summary.maxCpu.value}%`, color: COLORS.major, valueColor: COLORS.major },
    { label: '최고 MEM', value: `${summary.maxMem.value}%`, color: COLORS.critical, valueColor: COLORS.critical },
  ], y);

  const chartH = 72;
  const halfW = (USABLE_W - 6) / 2;

  // CPU / MEM Top 10
  y = addSectionTitle(pdf, 'CPU / MEM Top 10', y);

  const cpuTopImg = renderChartToImage(chartOptions.cpuTop, 560, 320);
  const memTopImg = renderChartToImage(chartOptions.memTop, 560, 320);

  addChartImage(pdf, cpuTopImg, MARGIN, y, halfW, chartH);
  addChartImage(pdf, memTopImg, MARGIN + halfW + 6, y, halfW, chartH);
  y += chartH + 6;

  // CPU / MEM 추이
  y = checkPageBreak(pdf, 90, y);
  y = addSectionTitle(pdf, 'CPU / MEM 추이', y);

  const cpuTrendImg = renderChartToImage(chartOptions.cpuTrend, 560, 280);
  const memTrendImg = renderChartToImage(chartOptions.memTrend, 560, 280);

  addChartImage(pdf, cpuTrendImg, MARGIN, y, halfW, chartH);
  addChartImage(pdf, memTrendImg, MARGIN + halfW + 6, y, halfW, chartH);
  y += chartH + 6;

  // CPU / MEM 분포
  y = checkPageBreak(pdf, 90, y);
  y = addSectionTitle(pdf, 'CPU / MEM 분포', y);

  const cpuDistImg = renderChartToImage(chartOptions.cpuDist, 480, 280);
  const memDistImg = renderChartToImage(chartOptions.memDist, 480, 280);

  addChartImage(pdf, cpuDistImg, MARGIN, y, halfW, chartH);
  addChartImage(pdf, memDistImg, MARGIN + halfW + 6, y, halfW, chartH);
  y += chartH + 6;

  // 장비별 트래픽 IN / OUT Top 10
  y = checkPageBreak(pdf, 90, y);
  y = addSectionTitle(pdf, '장비별 트래픽 IN / OUT Top 10', y);

  const trafficInImg = renderChartToImage(chartOptions.trafficInTop, 560, 320);
  const trafficOutImg = renderChartToImage(chartOptions.trafficOutTop, 560, 320);

  addChartImage(pdf, trafficInImg, MARGIN, y, halfW, chartH);
  addChartImage(pdf, trafficOutImg, MARGIN + halfW + 6, y, halfW, chartH);
  y += chartH + 6;

  // 포트별 트래픽 IN / OUT Top 10
  y = checkPageBreak(pdf, 90, y);
  y = addSectionTitle(pdf, '포트별 트래픽 IN / OUT Top 10', y);

  const portInImg = renderChartToImage(chartOptions.portInTop, 560, 320);
  const portOutImg = renderChartToImage(chartOptions.portOutTop, 560, 320);

  addChartImage(pdf, portInImg, MARGIN, y, halfW, chartH);
  addChartImage(pdf, portOutImg, MARGIN + halfW + 6, y, halfW, chartH);
  y += chartH + 6;

  // 트래픽 추이
  if (chartOptions.trafficTrend?.series) {
    y = checkPageBreak(pdf, 90, y);
    y = addSectionTitle(pdf, '트래픽 이용률 추이', y);

    const trafficTrendImg = renderChartToImage(chartOptions.trafficTrend, 1000, 320);
    addChartImage(pdf, trafficTrendImg, MARGIN, y, USABLE_W, 80);
    y += 86;
  }

  // 고부하 장비 테이블
  y = checkPageBreak(pdf, 50, y);
  y = addSectionTitle(pdf, '고부하 장비 (CPU 또는 MEM >= 80%)', y);

  if (highLoadDevices && highLoadDevices.length > 0) {
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['장비명', 'IP', 'CPU %', 'MEM %']],
      body: highLoadDevices.map(d => [
        d.DEVICE_NAME || '-',
        d.DEVICE_IP || '-',
        `${Number(d.cpu).toFixed(1)}%`,
        `${Number(d.mem).toFixed(1)}%`,
      ]),
      styles: {
        font: FONT_NAME,
        fontSize: 8,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 7,
      },
      bodyStyles: {
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'center', cellWidth: 25 },
      },
    });
  } else {
    setFont(pdf, 'normal', 9);
    pdf.setTextColor(COLORS.muted);
    pdf.text('고부하 장비가 없습니다', MARGIN + 4, y + 6);
  }
}

// ─── PDF 생성 엔트리 포인트 ───

export async function generateReportPdf(reportType, chartOptions, reportData) {
  try {
    const pdf = new jsPDF('landscape', 'mm', 'a4');

    // 한글 폰트 등록
    await loadKoreanFont(pdf);

    if (reportType === 'fault') {
      buildFaultReport(pdf, { chartOptions, reportData });
    } else if (reportType === 'performance') {
      buildPerfReport(pdf, { chartOptions, reportData });
    }

    return pdf.output('blob');
  } catch (err) {
    console.error('PDF 생성 오류:', err);
    throw err;
  }
}
