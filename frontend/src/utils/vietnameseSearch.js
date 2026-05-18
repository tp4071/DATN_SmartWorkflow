/**
 * Bỏ dấu tiếng Việt + chuyển về chữ thường để so khớp tìm kiếm.
 * "Dự án Việt Nam" -> "du an viet nam"
 */
export function removeVietnameseTones(str) {
  if (!str) return ''
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đ]/g, 'd')
    .replace(/[Đ]/g, 'D')
    .toLowerCase()
    .trim()
}

/**
 * Kiểm tra `keyword` có xuất hiện trong `text` hay không (không phân biệt dấu/hoa thường).
 * Keyword rỗng -> luôn true (không lọc).
 */
export function matchVietnamese(text, keyword) {
  if (!keyword) return true
  return removeVietnameseTones(text).includes(removeVietnameseTones(keyword))
}

/**
 * Lọc danh sách theo nhiều trường text, không phân biệt dấu.
 * @param {Array} list
 * @param {string} keyword
 * @param {Array<(item:any)=>string>} accessors - các hàm trích xuất text từ item
 */
export function filterByVietnameseKeyword(list, keyword, accessors) {
  if (!keyword) return list
  const needle = removeVietnameseTones(keyword)
  if (!needle) return list
  return list.filter((item) =>
    accessors.some((fn) => removeVietnameseTones(fn(item)).includes(needle))
  )
}
