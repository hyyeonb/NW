import { useSortable } from '@dnd-kit/sortable';

// DataTable의 드래그 가능한 헤더 셀.
function DraggableHeader({ column, children, sortable, onSort, sort, enableReorder, resizeHandle, computedWidth, autoWidth, filterIcon, filterDropdown }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    disabled: !enableReorder,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  // X축만 이동 (수평 드래그)
  const style = {
    transform: transform ? `translateX(${transform.x}px)` : undefined,
    transition,
    width: computedWidth || autoWidth || undefined,
    textAlign: column.columnDef.align || 'left',
    zIndex: isDragging ? 100 : undefined,
    position: 'relative',
  };

  // 정렬 아이콘 렌더링
  const renderSortIcon = () => {
    if (!sortable || !sort) return null;
    if (sort.field !== column.id) {
      return <i className="bi bi-chevron-expand sort-icon inactive"></i>;
    }
    return sort.order === 'asc'
      ? <i className="bi bi-chevron-up sort-icon active"></i>
      : <i className="bi bi-chevron-down sort-icon active"></i>;
  };

  // 클릭 핸들러 (드래그가 아닐 때만 정렬)
  const handleClick = (e) => {
    if (sortable && onSort && !isDragging) {
      onSort(column.id);
    }
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      data-col-id={column.id}
      className={`${sortable ? 'sortable' : ''} ${isDragging ? 'dragging' : ''} ${column.columnDef.className || ''}`}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      <div className="th-inner">
        <span className="th-label">{children}</span>
        {renderSortIcon()}
        {filterIcon}
      </div>
      {resizeHandle}
      {filterDropdown}
    </th>
  );
}

export default DraggableHeader;
