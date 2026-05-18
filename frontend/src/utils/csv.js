/**
 * Parser CSV gọn nhẹ, đủ dùng cho 99% trường hợp:
 *   - Phân cách bằng dấu phẩy.
 *   - Hỗ trợ trường có dấu phẩy/xuống dòng nếu được bao trong dấu nháy kép "...".
 *   - Escape dấu nháy kép trong field bằng "" (chuẩn RFC 4180).
 *   - Chấp nhận line ending CRLF / LF / CR.
 *   - Tự bỏ qua dòng trống.
 *
 * Trả về mảng các mảng string (chưa gắn header). Caller tự xử lý header.
 */
export function parseCsv(text) {
  if (typeof text !== 'string' || text.length === 0) return []

  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        field += ch
        i++
      }
      continue
    }

    if (ch === '"' && field === '') {
      inQuotes = true
      i++
    } else if (ch === ',') {
      row.push(field)
      field = ''
      i++
    } else if (ch === '\n' || ch === '\r') {
      row.push(field)
      field = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
      if (ch === '\r' && text[i + 1] === '\n') i += 2
      else i++
    } else {
      field += ch
      i++
    }
  }

  // Field cuối cùng
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((c) => c !== '')) rows.push(row)
  }

  return rows
}

/**
 * Đọc File/Blob thành text. Tự thử UTF-8, fallback sang UTF-16 nếu cần.
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Không đọc được tệp'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsText(file, 'utf-8')
  })
}

/**
 * Sinh chuỗi CSV từ array of objects + danh sách cột.
 * Tự bao field bằng "" nếu chứa dấu phẩy / nháy kép / xuống dòng.
 */
export function toCsv(rows, columns) {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    if (/[",\r\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const header = columns.map(escape).join(',')
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(',')).join('\n')
  return body ? `${header}\n${body}` : header
}

/**
 * Trigger trình duyệt tải file CSV. (Frontend-only, không gọi backend.)
 */
export function downloadCsv(filename, csvText) {
  const BOM = '﻿' // Để Excel mở UTF-8 đúng tiếng Việt
  const blob = new Blob([BOM + csvText], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
