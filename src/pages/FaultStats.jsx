import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import DatePicker from 'react-datepicker';
import { ko } from 'date-fns/locale';
import { format, subDays } from 'date-fns';
import { faultApi } from '../api/fault';
import { devicesApi } from '../api/devices';
import WatchSidebar from '../components/WatchSidebar';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { useWatchGroupDetail } from '../hooks/useWatch';
import '../styles/fault-stats.css';

const PERIOD_OPTIONS = [
  { label: '오늘', days: 0 },
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
];

const LEVEL_MAP = { C: 'Critical', M: 'Major', N: 'Minor', W: 'Warning' };
const LEVEL_COLORS = { C: '#ef4444', M: '#f97316', N: '#eab308', W: '#3b82f6' };
const TYPE_COLORS = {
  PING: '#ef4444', SNMP: '#f97316', CPU: '#8b5cf6',
  MEMORY: '#3b82f6', PORT: '#06b6d4', TRAFFIC: '#10b981',
};
const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

export default function FaultStats() {
  const [periodIdx, setPeriodIdx] = useState(2); // 기본 30일
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const isCustom = periodIdx === -1;

  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  // 관제 그룹 기반 필터링
  const [selectedGroup, setSelectedGroup] = useState(null);

  // 선택된 관제 그룹의 장비 목록 조회 (linkedGroupId 유무와 무관하게 동작)
  const { data: groupDetail } = useWatchGroupDetail(selectedGroup?.watchGroupId);

  // 일반 그룹 선택 시 장비 목록 조회
  const { data: regularDevices } = useQuery({
    queryKey: ['regularGroupDevices', selectedGroup?.groupId],
    queryFn: () => devicesApi.getDevicesByGroup(selectedGroup.groupId).then(r => r.data?.data?.content || []),
    enabled: !!selectedGroup?.groupId && selectedGroup?.type === 'regular',
  });

  // 그룹에 속한 deviceIds 추출
  const deviceIdsParam = useMemo(() => {
    if (!selectedGroup) return undefined;
    if (selectedGroup.type === 'regular') {
      return regularDevices?.length ? regularDevices.map(d => d.DEVICE_ID) : undefined;
    }
    if (selectedGroup.watchGroupId && groupDetail?.devices?.length) {
      return groupDetail.devices.map(d => d.deviceId);
    }
    return undefined;
  }, [selectedGroup, groupDetail, regularDevices]);

  const { startDate, endDate } = useMemo(() => {
    if (isCustom && customStart && customEnd) {
      return {
        startDate: format(customStart, 'yyyy-MM-dd'),
        endDate: format(customEnd, 'yyyy-MM-dd'),
      };
    }
    const days = PERIOD_OPTIONS[periodIdx]?.days ?? 30;
    return {
      startDate: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    };
  }, [periodIdx, isCustom, customStart, customEnd]);

  const isToday = startDate === endDate;
  const trendPeriod = isToday ? 'hourly' : 'daily';
  const dateParams = { startDate, endDate };

  // API 호출 (groupIds 필터 적용)
  // queryKey에 deviceIdsParam만 포함 — 연동 그룹 변경 시 자동 refetch, 비연동 그룹은 동일 데이터이므로 캐시 사용
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['faultStats', 'summary', deviceIdsParam],
    queryFn: () => faultApi.getStatsSummary({ deviceIds: deviceIdsParam }).then(r => r.data?.data),
    refetchInterval: 60000,
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['faultStats', 'trend', startDate, endDate, trendPeriod, deviceIdsParam],
    queryFn: () => faultApi.getStatsTrend({ ...dateParams, period: trendPeriod, deviceIds: deviceIdsParam }).then(r => r.data?.data),
  });

  const { data: mttrData } = useQuery({
    queryKey: ['faultStats', 'mttr', startDate, endDate, deviceIdsParam],
    queryFn: () => faultApi.getStatsMttr({ ...dateParams, deviceIds: deviceIdsParam }).then(r => r.data?.data),
  });

  const { data: topDevices } = useQuery({
    queryKey: ['faultStats', 'topDevices', startDate, endDate, deviceIdsParam],
    queryFn: () => faultApi.getStatsTopDevices({ ...dateParams, limit: 10, deviceIds: deviceIdsParam }).then(r => r.data?.data),
  });

  const { data: patternData, isLoading: patternLoading } = useQuery({
    queryKey: ['faultStats', 'pattern', startDate, endDate, deviceIdsParam],
    queryFn: () => faultApi.getStatsPattern({ ...dateParams, deviceIds: deviceIdsParam }).then(r => r.data?.data),
  });

  // 등급별 카운트
  const levelCounts = useMemo(() => {
    const map = { C: 0, M: 0, N: 0, W: 0 };
    (summaryData?.byLevel || []).forEach(r => { map[r.LEVEL_CODE] = Number(r.CNT); });
    return map;
  }, [summaryData]);

  const totalActive = Object.values(levelCounts).reduce((a, b) => a + b, 0);

  // 기간 선택 핸들러
  const handlePeriod = useCallback((idx) => {
    setPeriodIdx(idx);
  }, []);

  const handleCustom = useCallback(() => {
    setPeriodIdx(-1);
    if (!customStart) setCustomStart(subDays(new Date(), 30));
    if (!customEnd) setCustomEnd(new Date());
  }, [customStart, customEnd]);

  // ========== 차트 옵션 ==========

  // 유형별 도넛
  const typeDonutOption = useMemo(() => {
    const list = summaryData?.byType || [];
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 15, 35, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#f8fafc' },
        formatter: '{b}: {c}건 ({d}%)',
      },
      legend: {
        orient: 'vertical', right: 10, top: 'center',
        textStyle: { color: '#94a3b8', fontSize: 12 },
      },
      series: [{
        type: 'pie', radius: ['45%', '70%'], center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: 'rgba(15,15,35,0.8)', borderWidth: 2 },
        label: {
          show: true, fontSize: 12, color: '#e2e8f0',
          formatter: '{b}\n{c}건 ({d}%)',
        },
        emphasis: {
          label: { fontSize: 14, fontWeight: 'bold', color: '#f8fafc' },
        },
        data: list.map(r => ({
          value: Number(r.CNT), name: r.ERROR_TYPE,
          itemStyle: { color: TYPE_COLORS[r.ERROR_TYPE] || '#64748b' },
        })),
      }],
    };
  }, [summaryData]);

  // 발생/해소 추이 (daily 또는 hourly 자동 전환)
  const trendChartOption = useMemo(() => {
    const isHourly = trendData?.period === 'hourly';

    if (isHourly) {
      // 시간대별: 0~23시 전체 슬롯 채우기
      const raw = trendData?.hourly || [];
      const hourMap = {};
      raw.forEach(r => { hourMap[Number(r.STAT_HOUR)] = r; });
      const hours = Array.from({ length: 24 }, (_, i) => i);

      return {
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(15, 15, 35, 0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          textStyle: { color: '#f8fafc' },
          formatter: (params) => {
            const h = params[0]?.name;
            const occurred = params.find(p => p.seriesName === '발생')?.value || 0;
            const cleared = params.find(p => p.seriesName === '해소')?.value || 0;
            return `<b>${h}시</b><br/>발생: ${occurred}건<br/>해소: ${cleared}건`;
          },
        },
        legend: {
          data: ['발생', '해소'],
          textStyle: { color: '#94a3b8', fontSize: 11 },
          top: 0,
        },
        grid: { left: 40, right: 16, top: 36, bottom: 24 },
        xAxis: {
          type: 'category',
          data: hours.map(h => `${h}`),
          axisLabel: { color: '#64748b', fontSize: 11, formatter: (v) => `${v}시` },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        },
        yAxis: {
          type: 'value', minInterval: 1,
          axisLabel: { color: '#64748b', fontSize: 11 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            name: '발생', type: 'bar', barMaxWidth: 16,
            data: hours.map(h => Number(hourMap[h]?.OCCURRED || 0)),
            itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] },
          },
          {
            name: '해소', type: 'bar', barMaxWidth: 16,
            data: hours.map(h => Number(hourMap[h]?.CLEARED || 0)),
            itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
          },
        ],
      };
    }

    // 일별
    const daily = trendData?.daily || [];
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 15, 35, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#f8fafc' },
      },
      legend: {
        data: ['발생', '해소'],
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
      },
      grid: { left: 40, right: 16, top: 36, bottom: 24 },
      xAxis: {
        type: 'category',
        data: daily.map(r => r.STAT_DATE?.substring(5)),
        axisLabel: { color: '#64748b', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value', minInterval: 1,
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [
        {
          name: '발생', type: 'bar', barMaxWidth: 20,
          data: daily.map(r => Number(r.OCCURRED)),
          itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '해소', type: 'bar', barMaxWidth: 20,
          data: daily.map(r => Number(r.CLEARED)),
          itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }, [trendData]);

  // 유형별 추이 (daily: 스택 영역 / hourly: 시간대별 스택)
  const typeTrendOption = useMemo(() => {
    const isHourly = trendData?.period === 'hourly';
    const raw = trendData?.byType || [];
    const types = [...new Set(raw.map(r => r.ERROR_TYPE))];
    const map = {};

    if (isHourly) {
      raw.forEach(r => { map[`${Number(r.STAT_HOUR)}_${r.ERROR_TYPE}`] = Number(r.CNT); });
      const hours = Array.from({ length: 24 }, (_, i) => i);

      return {
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(15, 15, 35, 0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          textStyle: { color: '#f8fafc' },
        },
        legend: {
          data: types,
          textStyle: { color: '#94a3b8', fontSize: 11 },
          top: 0,
        },
        grid: { left: 40, right: 16, top: 36, bottom: 24 },
        xAxis: {
          type: 'category',
          data: hours.map(h => `${h}`),
          axisLabel: { color: '#64748b', fontSize: 11, formatter: (v) => `${v}시` },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        },
        yAxis: {
          type: 'value', minInterval: 1,
          axisLabel: { color: '#64748b', fontSize: 11 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: types.map(t => ({
          name: t, type: 'bar', stack: 'total', barMaxWidth: 16,
          itemStyle: { color: TYPE_COLORS[t] || '#64748b', borderRadius: [2, 2, 0, 0] },
          data: hours.map(h => map[`${h}_${t}`] || 0),
        })),
      };
    }

    // 일별
    const dates = [...new Set(raw.map(r => r.STAT_DATE))].sort();
    raw.forEach(r => { map[`${r.STAT_DATE}_${r.ERROR_TYPE}`] = Number(r.CNT); });

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 15, 35, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#f8fafc' },
      },
      legend: {
        data: types,
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
      },
      grid: { left: 40, right: 16, top: 36, bottom: 24 },
      xAxis: {
        type: 'category',
        data: dates.map(d => d?.substring(5)),
        axisLabel: { color: '#64748b', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value', minInterval: 1,
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: types.map(t => ({
        name: t, type: 'line', stack: 'total', smooth: true, showSymbol: false,
        areaStyle: { opacity: 0.15 },
        lineStyle: { width: 2 },
        itemStyle: { color: TYPE_COLORS[t] || '#64748b' },
        data: dates.map(d => map[`${d}_${t}`] || 0),
      })),
    };
  }, [trendData]);

  // MTTR 바 차트
  const mttrChartOption = useMemo(() => {
    const list = (mttrData || []).sort((a, b) => Number(b.AVG_SECONDS) - Number(a.AVG_SECONDS));
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 15, 35, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#f8fafc' },
        formatter: (params) => {
          const d = params[0];
          const item = list[d.dataIndex];
          return `<b>${d.name}</b><br/>
            평균: ${formatDuration(Number(item?.AVG_SECONDS))}<br/>
            최소: ${formatDuration(Number(item?.MIN_SECONDS))}<br/>
            최대: ${formatDuration(Number(item?.MAX_SECONDS))}<br/>
            건수: ${item?.CNT}건`;
        },
      },
      grid: { left: 80, right: 24, top: 8, bottom: 24 },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: '#64748b', fontSize: 11,
          formatter: (v) => formatDuration(v),
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'category',
        data: list.map(r => r.ERROR_TYPE),
        axisLabel: { color: '#94a3b8', fontSize: 12, fontWeight: 500 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [{
        type: 'bar', barMaxWidth: 24,
        data: list.map(r => ({
          value: Number(r.AVG_SECONDS),
          itemStyle: { color: TYPE_COLORS[r.ERROR_TYPE] || '#64748b', borderRadius: [0, 4, 4, 0] },
        })),
      }],
    };
  }, [mttrData]);

  // 시간대별 패턴 바 차트
  const hourPatternOption = useMemo(() => {
    const raw = patternData?.byHour || [];
    const map = {};
    raw.forEach(r => { map[Number(r.HOUR_OF_DAY)] = Number(r.CNT); });
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const data = hours.map(h => map[h] || 0);
    const maxVal = Math.max(...data, 1);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 15, 35, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#f8fafc' },
        formatter: (params) => `${params[0].name}시: ${params[0].value}건`,
      },
      grid: { left: 36, right: 16, top: 8, bottom: 24 },
      xAxis: {
        type: 'category',
        data: hours.map(h => `${h}`),
        axisLabel: { color: '#64748b', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value', minInterval: 1,
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [{
        type: 'bar', barMaxWidth: 16,
        data: data.map(v => ({
          value: v,
          itemStyle: {
            color: `rgba(99, 102, 241, ${0.3 + (v / maxVal) * 0.7})`,
            borderRadius: [3, 3, 0, 0],
          },
        })),
      }],
    };
  }, [patternData]);

  // 요일별 패턴
  const dowPatternOption = useMemo(() => {
    const raw = patternData?.byDow || [];
    const map = {};
    raw.forEach(r => { map[Number(r.DAY_OF_WEEK)] = Number(r.CNT); });
    const data = DOW_LABELS.map((_, i) => map[i + 1] || 0);
    const maxVal = Math.max(...data, 1);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 15, 35, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#f8fafc' },
        formatter: (params) => `${params[0].name}: ${params[0].value}건`,
      },
      grid: { left: 36, right: 16, top: 8, bottom: 24 },
      xAxis: {
        type: 'category',
        data: DOW_LABELS,
        axisLabel: { color: '#64748b', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value', minInterval: 1,
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [{
        type: 'bar', barMaxWidth: 32,
        data: data.map(v => ({
          value: v,
          itemStyle: {
            color: `rgba(139, 92, 246, ${0.3 + (v / maxVal) * 0.7})`,
            borderRadius: [4, 4, 0, 0],
          },
        })),
      }],
    };
  }, [patternData]);

  // Aging 분포
  const agingData = useMemo(() => {
    const map = { '1h_under': 0, '1h_6h': 0, '6h_24h': 0, '24h_over': 0 };
    (summaryData?.aging || []).forEach(r => { map[r.AGE_GROUP] = Number(r.CNT); });
    return [
      { label: '1시간 미만', key: '1h_under', color: '#10b981' },
      { label: '1~6시간', key: '1h_6h', color: '#f59e0b' },
      { label: '6~24시간', key: '6h_24h', color: '#f97316' },
      { label: '24시간 이상', key: '24h_over', color: '#ef4444' },
    ].map(item => ({ ...item, count: map[item.key] }));
  }, [summaryData]);

  // 전체 MTTR 평균
  const avgMttr = useMemo(() => {
    if (!mttrData || mttrData.length === 0) return 0;
    const totalSec = mttrData.reduce((sum, r) => sum + Number(r.AVG_SECONDS) * Number(r.CNT), 0);
    const totalCnt = mttrData.reduce((sum, r) => sum + Number(r.CNT), 0);
    return totalCnt > 0 ? Math.round(totalSec / totalCnt) : 0;
  }, [mttrData]);

  return (
    <div className="fault-stats-container">
      {/* Header - 상단 전체 너비 */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-bar-chart-line"></i>
            장애 통계
          </h1>
          <span className="page-subtitle">장애 발생 현황 및 분석</span>
        </div>
        <div className="page-header-right">
          <button
            className="pdf-export-btn"
            onClick={() => setPdfPreviewOpen(true)}
            title="PDF 미리보기"
          >
            <i className="bi bi-file-earmark-pdf"></i>
            PDF
          </button>
          <div className="period-selector">
            {PERIOD_OPTIONS.map((opt, idx) => (
              <button
                key={idx}
                className={`period-btn ${periodIdx === idx ? 'active' : ''}`}
                onClick={() => handlePeriod(idx)}
              >
                {opt.label}
              </button>
            ))}
            <button
              className={`period-btn ${isCustom ? 'active' : ''}`}
              onClick={handleCustom}
            >
              직접선택
            </button>
          </div>
          {isCustom && (
            <div className="custom-date-range">
              <DatePicker
                selected={customStart}
                onChange={setCustomStart}
                selectsStart
                startDate={customStart}
                endDate={customEnd}
                maxDate={customEnd || new Date()}
                dateFormat="yyyy-MM-dd"
                locale={ko}
                className="date-picker-input"
                placeholderText="시작일"
              />
              <span className="date-separator">~</span>
              <DatePicker
                selected={customEnd}
                onChange={setCustomEnd}
                selectsEnd
                startDate={customStart}
                endDate={customEnd}
                minDate={customStart}
                maxDate={new Date()}
                dateFormat="yyyy-MM-dd"
                locale={ko}
                className="date-picker-input"
                placeholderText="종료일"
              />
            </div>
          )}
        </div>
      </div>

      {/* 패널 래퍼: 사이드바 + 콘텐츠 (실시간 성능 감시와 동일 구조) */}
      <div className="fault-stats-panels-wrapper">
        <WatchSidebar
          onGroupSelect={setSelectedGroup}
          title="관제 그룹"
          titleIcon="bi bi-bar-chart-line"
        />
        <div className="fault-stats-content">
      <PdfPreviewModal
        open={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        fileName={`장애통계_${startDate}_${endDate}`}
        reportType="fault"
        chartOptions={{
          typeDonut: typeDonutOption,
          trendChart: trendChartOption,
          typeTrend: typeTrendOption,
          mttrChart: mttrChartOption,
          hourPattern: hourPatternOption,
          dowPattern: dowPatternOption,
        }}
        reportData={{
          levelCounts,
          totalActive,
          avgMttr,
          agingData,
          topDevices: topDevices || [],
          summaryByType: summaryData?.byType || [],
          period: { startDate, endDate, isToday },
        }}
      />

      {/* Summary Cards */}
      <div className="stats-summary-row">
        <div className="stats-card summary-total">
          <div className="stats-card-label">전체 활성 장애</div>
          <div className="stats-card-value">{totalActive}</div>
        </div>
        {Object.entries(LEVEL_MAP).map(([code, label]) => (
          <div key={code} className={`stats-card summary-level level-${code.toLowerCase()}`}>
            <div className="stats-card-label">{label}</div>
            <div className="stats-card-value" style={{ color: LEVEL_COLORS[code] }}>
              {levelCounts[code]}
            </div>
          </div>
        ))}
        <div className="stats-card summary-mttr">
          <div className="stats-card-label">평균 MTTR</div>
          <div className="stats-card-value">{formatDuration(avgMttr)}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="stats-grid">
        {/* Row 1: 유형별 현황 + 일별 추이 */}
        <div className="stats-panel panel-type-donut">
          <div className="stats-panel-header">
            <i className="bi bi-pie-chart"></i>
            유형별 현황
          </div>
          <div className="stats-panel-body">
            {summaryLoading ? <LoadingSpinner /> : (
              <SafeECharts option={typeDonutOption} style={{ height: '100%' }} notMerge={false} />
            )}
          </div>
        </div>

        <div className="stats-panel panel-daily-trend">
          <div className="stats-panel-header">
            <i className="bi bi-graph-up"></i>
            {isToday ? '시간대별' : '일별'} 발생/해소 추이
          </div>
          <div className="stats-panel-body">
            {trendLoading ? <LoadingSpinner /> : (
              <SafeECharts option={trendChartOption} style={{ height: '100%' }} notMerge={false} />
            )}
          </div>
        </div>

        {/* Row 2: 유형별 추이 + MTTR */}
        <div className="stats-panel panel-type-trend">
          <div className="stats-panel-header">
            <i className="bi bi-layers"></i>
            유형별 {isToday ? '시간대별' : '일별'} 발생 추이
          </div>
          <div className="stats-panel-body">
            {trendLoading ? <LoadingSpinner /> : (
              <SafeECharts option={typeTrendOption} style={{ height: '100%' }} notMerge={false} />
            )}
          </div>
        </div>

        <div className="stats-panel panel-mttr">
          <div className="stats-panel-header">
            <i className="bi bi-stopwatch"></i>
            유형별 평균 처리시간 (MTTR)
          </div>
          <div className="stats-panel-body">
            {(!mttrData || mttrData.length === 0)
              ? <EmptyState message="해소된 장애 이력이 없습니다" />
              : <SafeECharts option={mttrChartOption} style={{ height: '100%' }} notMerge={false} />
            }
          </div>
        </div>

        {/* Row 3: 시간대별 + 요일별 */}
        <div className="stats-panel panel-hour-pattern">
          <div className="stats-panel-header">
            <i className="bi bi-clock"></i>
            시간대별 장애 분포
          </div>
          <div className="stats-panel-body">
            {patternLoading ? <LoadingSpinner /> : (
              <SafeECharts option={hourPatternOption} style={{ height: '100%' }} notMerge={false} />
            )}
          </div>
        </div>

        <div className="stats-panel panel-dow-pattern">
          <div className="stats-panel-header">
            <i className="bi bi-calendar-week"></i>
            요일별 장애 분포
          </div>
          <div className="stats-panel-body">
            {patternLoading ? <LoadingSpinner /> : (
              <SafeECharts option={dowPatternOption} style={{ height: '100%' }} notMerge={false} />
            )}
          </div>
        </div>

        {/* Row 4: Aging + 상습 장애 장비 */}
        <div className="stats-panel panel-aging">
          <div className="stats-panel-header">
            <i className="bi bi-hourglass-split"></i>
            미해소 장애 Aging
          </div>
          <div className="stats-panel-body aging-body">
            {agingData.map(item => (
              <div key={item.key} className="aging-bar-row">
                <span className="aging-label">{item.label}</span>
                <div className="aging-bar-track">
                  <div
                    className="aging-bar-fill"
                    style={{
                      width: totalActive > 0 ? `${(item.count / totalActive) * 100}%` : '0%',
                      background: item.color,
                    }}
                  />
                </div>
                <span className="aging-count" style={{ color: item.color }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-panel panel-top-devices">
          <div className="stats-panel-header">
            <i className="bi bi-exclamation-diamond"></i>
            상습 장애 장비 Top 10
          </div>
          <div className="stats-panel-body top-devices-body">
            {(!topDevices || topDevices.length === 0) ? (
              <EmptyState message="기간 내 장애 이력이 없습니다" />
            ) : (
              <table className="top-devices-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>장비명</th>
                    <th>IP</th>
                    <th>그룹</th>
                    <th>총 건수</th>
                    <th>활성</th>
                  </tr>
                </thead>
                <tbody>
                  {topDevices.map((d, i) => (
                    <tr key={d.DEVICE_ID}>
                      <td className="rank">{i + 1}</td>
                      <td className="device-name">{d.DEVICE_NAME}</td>
                      <td className="device-ip">{d.DEVICE_IP}</td>
                      <td className="group-name">{d.GROUP_NAME || '-'}</td>
                      <td className="count">{Number(d.TOTAL_CNT)}</td>
                      <td className="active-count">
                        {Number(d.ACTIVE_CNT) > 0 && (
                          <span className="active-badge">{Number(d.ACTIVE_CNT)}</span>
                        )}
                        {Number(d.ACTIVE_CNT) === 0 && '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}

// React 19 StrictMode + echarts-for-react ResizeObserver 호환성 래퍼
// StrictMode의 mount→unmount→remount 사이클에서 ResizeObserver 미생성 시 disconnect() 에러 방지
function SafeECharts(props) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    return () => setReady(false);
  }, []);
  if (!ready) return <div style={props.style} />;
  return <ReactECharts {...props} />;
}

function LoadingSpinner() {
  return (
    <div className="stats-loading">
      <div className="loading-spinner" />
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="stats-empty">
      <i className="bi bi-inbox"></i>
      <span>{message}</span>
    </div>
  );
}
