/**
 * Khung chứa các điều khiển lọc (search, dropdown, ...) đặt trên đầu trang danh sách.
 * Bố trí: stack trên mobile, hàng ngang trên md+. Cho phép `right` slot căn về cuối hàng.
 *
 * Ví dụ:
 *   <FilterBar right={<span>{count} kết quả</span>}>
 *     <SearchInput ... widthClass="w-full sm:w-72" />
 *     <Select ... widthClass="w-full sm:w-44" />
 *   </FilterBar>
 */
export function FilterBar({ children, right, className = '' }) {
  return (
    <div
      className={`bg-white border border-neutral-200 rounded-lg p-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-center shadow-sm ${className}`}
    >
      {children}
      {right ? <div className="sm:ml-auto flex items-center gap-2">{right}</div> : null}
    </div>
  )
}
