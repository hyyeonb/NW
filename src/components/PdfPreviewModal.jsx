import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateReportPdf } from '../utils/pdfReportBuilder';

/**
 * PDF 미리보기 모달 (오프스크린 ECharts 렌더링 + jsPDF 기반)
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - fileName: string - PDF 파일명 (확장자 제외)
 * - reportType: 'fault' | 'performance'
 * - chartOptions: { [key]: ECharts option } - 각 차트의 옵션 객체
 * - reportData: object - 원시 데이터 (테이블/요약 카드용)
 */
export default function PdfPreviewModal({ open, onClose, fileName = '통계', reportType, chartOptions, reportData }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const blobRef = useRef(null);

  // 모달 열릴 때 PDF 생성
  useEffect(() => {
    if (!open || !reportType || !chartOptions || !reportData) return;

    let cancelled = false;
    setGenerating(true);
    setPdfUrl(null);

    generateReportPdf(reportType, chartOptions, reportData)
      .then(blob => {
        if (cancelled) return;
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .catch(err => {
        console.error('PDF 생성 실패:', err);
      })
      .finally(() => {
        if (!cancelled) setGenerating(false);
      });

    return () => { cancelled = true; };
  }, [open, reportType, chartOptions, reportData]);

  // 모달 닫힐 때 정리
  useEffect(() => {
    if (!open) {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      blobRef.current = null;
    }
  }, [open]);

  const handleDownload = useCallback(() => {
    if (!blobRef.current) return;
    setDownloading(true);
    try {
      const url = URL.createObjectURL(blobRef.current);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF 다운로드 실패:', err);
    } finally {
      setDownloading(false);
    }
  }, [fileName]);

  if (!open) return null;

  return createPortal(
    <div className="pdf-preview-backdrop" onClick={onClose}>
      <div className="pdf-preview-modal" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="pdf-preview-header">
          <div className="pdf-preview-title">
            <i className="bi bi-file-earmark-pdf"></i>
            PDF 미리보기
          </div>
          <div className="pdf-preview-actions">
            <button
              className="pdf-download-btn"
              onClick={handleDownload}
              disabled={!blobRef.current || downloading}
            >
              {downloading ? (
                <span className="pdf-spinner" />
              ) : (
                <i className="bi bi-download"></i>
              )}
              다운로드
            </button>
            <button className="pdf-close-btn" onClick={onClose}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        {/* 미리보기 영역 */}
        <div className="pdf-preview-body">
          {generating ? (
            <div className="pdf-preview-loading">
              <div className="loading-spinner" />
              <span>PDF 생성 중...</span>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="PDF Preview"
              className="pdf-preview-iframe"
            />
          ) : (
            <div className="pdf-preview-loading">
              <span>미리보기를 생성할 수 없습니다</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
