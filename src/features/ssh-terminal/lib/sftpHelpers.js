// SFTP 파일 브라우저용 헬퍼.

// 파일 크기 표기 — bytes < 0 은 '-', bytes === 0 은 '0 B', 나머지는 사람-친화 단위.
export function formatSize(bytes) {
  if (bytes == null || bytes < 0) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// 파일 확장자별 Bootstrap Icons 클래스 매핑.
export function getFileIcon(name, isDir) {
  if (isDir) return 'bi-folder-fill';
  const ext = name?.split('.').pop()?.toLowerCase();
  const icons = {
    log: 'bi-file-text', txt: 'bi-file-text', md: 'bi-file-text',
    sh: 'bi-terminal', bash: 'bi-terminal', py: 'bi-filetype-py',
    js: 'bi-filetype-js', json: 'bi-filetype-json', xml: 'bi-filetype-xml',
    html: 'bi-filetype-html', css: 'bi-filetype-css',
    java: 'bi-filetype-java', jar: 'bi-file-zip',
    zip: 'bi-file-zip', tar: 'bi-file-zip', gz: 'bi-file-zip',
    conf: 'bi-gear', cfg: 'bi-gear', ini: 'bi-gear', yml: 'bi-gear', yaml: 'bi-gear',
    png: 'bi-file-image', jpg: 'bi-file-image', gif: 'bi-file-image', svg: 'bi-file-image',
    pdf: 'bi-filetype-pdf', doc: 'bi-filetype-doc', xls: 'bi-filetype-xlsx',
  };
  return icons[ext] || 'bi-file-earmark';
}
