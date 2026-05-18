import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Button, Icon, Pill } from '../../components/ui'
import { parseCsv, readFileAsText, toCsv, downloadCsv } from '../../utils/csv'
import { bulkCreateUsers } from '../../services/users.api'

const REQUIRED_COLUMNS = ['full_name', 'email', 'password', 'system_role']
const TEMPLATE_ROWS = [
  {
    full_name: 'Nguyễn Văn A',
    email: 'a@example.com',
    password: 'Pass1234',
    system_role: 'USER',
  },
  {
    full_name: 'Trần Thị B',
    email: 'b@example.com',
    password: 'Pass1234',
    system_role: 'ADMIN',
  },
]

// 3 trạng thái UI bên trong modal:
//   'idle'       — đang chọn file / preview, chưa gửi
//   'submitting' — đã bấm Nhập, đợi backend
//   'done'       — backend trả kết quả; hiện summary, đợi user đóng / nhập tiếp
const STAGES = { IDLE: 'idle', SUBMITTING: 'submitting', DONE: 'done' }

function mapHeaderIndex(headerRow) {
  // Trả về { full_name: idx, email: idx, password: idx, system_role: idx }
  // Tên cột không phân biệt hoa/thường, tự trim.
  const map = {}
  headerRow.forEach((name, idx) => {
    const key = String(name || '').trim().toLowerCase()
    if (REQUIRED_COLUMNS.includes(key) && map[key] === undefined) {
      map[key] = idx
    }
  })
  return map
}

function rowsFromCsv(rawRows) {
  if (rawRows.length === 0) {
    return { error: 'Tệp CSV rỗng.', rows: [] }
  }
  const [header, ...dataRows] = rawRows
  const idx = mapHeaderIndex(header)
  const missing = REQUIRED_COLUMNS.filter((c) => idx[c] === undefined)
  if (missing.length > 0) {
    return {
      error: `Tệp CSV thiếu cột bắt buộc: ${missing.join(', ')}.`,
      rows: [],
    }
  }
  const rows = dataRows.map((r) => ({
    full_name: (r[idx.full_name] ?? '').trim(),
    email: (r[idx.email] ?? '').trim(),
    password: r[idx.password] ?? '',
    system_role: (r[idx.system_role] ?? '').trim().toUpperCase(),
  }))
  return { error: null, rows }
}

export function BulkImportUsersModal({ open, onClose, onCompleted }) {
  const fileInputRef = useRef(null)

  const [stage, setStage] = useState(STAGES.IDLE)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState(null)
  const [rows, setRows] = useState([])
  const [submitError, setSubmitError] = useState(null)
  const [result, setResult] = useState(null)

  // Reset khi mở
  useEffect(() => {
    if (!open) return
    setStage(STAGES.IDLE)
    setFileName('')
    setParseError(null)
    setRows([])
    setSubmitError(null)
    setResult(null)
  }, [open])

  const handlePickFile = () => fileInputRef.current?.click()

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset để cho phép chọn lại cùng tệp
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    setRows([])
    setResult(null)
    setStage(STAGES.IDLE)

    try {
      const text = await readFileAsText(file)
      const raw = parseCsv(text)
      const { error, rows: parsedRows } = rowsFromCsv(raw)
      if (error) {
        setParseError(error)
        return
      }
      if (parsedRows.length === 0) {
        setParseError('Không có dòng dữ liệu nào sau header.')
        return
      }
      if (parsedRows.length > 500) {
        setParseError('Tối đa 500 dòng mỗi lần nhập. Vui lòng chia nhỏ tệp.')
        return
      }
      setRows(parsedRows)
    } catch (err) {
      setParseError(err.message || 'Không đọc được tệp CSV.')
    }
  }

  const handleDownloadTemplate = () => {
    const csv = toCsv(TEMPLATE_ROWS, REQUIRED_COLUMNS)
    downloadCsv('mau_nhap_nhan_su.csv', csv)
  }

  const handleSubmit = async () => {
    if (rows.length === 0) return
    setStage(STAGES.SUBMITTING)
    setSubmitError(null)
    try {
      const data = await bulkCreateUsers(rows)
      setResult(data)
      setStage(STAGES.DONE)
      // Cho parent cập nhật bảng nếu có ít nhất 1 dòng được tạo
      if (data?.created?.length > 0) {
        onCompleted?.(data.created)
      }
    } catch (err) {
      setSubmitError(err.message || 'Không nhập được danh sách. Vui lòng thử lại.')
      setStage(STAGES.IDLE)
    }
  }

  const handleStartOver = () => {
    setStage(STAGES.IDLE)
    setFileName('')
    setRows([])
    setResult(null)
    setSubmitError(null)
    setParseError(null)
  }

  const previewRows = useMemo(() => rows.slice(0, 10), [rows])

  return (
    <Modal
      open={open}
      onClose={stage === STAGES.SUBMITTING ? () => {} : onClose}
      title="Nhập nhân sự từ tệp CSV"
      size="lg"
      footer={
        stage === STAGES.DONE ? (
          <>
            <Button variant="ghost" onClick={handleStartOver}>
              Nhập tệp khác
            </Button>
            <Button variant="primary" onClick={onClose}>
              Đóng
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={stage === STAGES.SUBMITTING}>
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={stage === STAGES.SUBMITTING || rows.length === 0 || !!parseError}
            >
              {stage === STAGES.SUBMITTING ? (
                <>
                  <Icon name="progress_activity" className="text-sm spin" />
                  Đang nhập...
                </>
              ) : (
                <>
                  <Icon name="upload" className="text-[18px]" />
                  Nhập {rows.length > 0 ? `${rows.length} dòng` : ''}
                </>
              )}
            </Button>
          </>
        )
      }
    >
      <div className="p-6 flex flex-col gap-4">
        {stage === STAGES.DONE ? (
          <ResultPanel result={result} originalRows={rows} />
        ) : (
          <>
            <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 text-sm">
              <p className="font-semibold text-primary-900 mb-2 flex items-center gap-1.5">
                <Icon name="info" filled className="text-[16px]" /> Hướng dẫn
              </p>
              <ul className="text-on-surface-variant text-[13px] space-y-1 ml-5 list-disc">
                <li>
                  Tệp <b>.csv</b>, mã hóa UTF-8, cột bắt buộc:{' '}
                  <code className="text-[12px] bg-white px-1 rounded">{REQUIRED_COLUMNS.join(', ')}</code>
                </li>
                <li>
                  <b>system_role</b> phải là <code>ADMIN</code> hoặc <code>USER</code>.
                </li>
                <li>Mật khẩu &geq; 6 ký tự — sẽ được hash bcrypt trước khi lưu.</li>
                <li>Tối đa 500 dòng mỗi lần nhập.</li>
              </ul>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline"
              >
                <Icon name="download" className="text-[16px]" />
                Tải tệp mẫu
              </button>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={handlePickFile}
                disabled={stage === STAGES.SUBMITTING}
                className="w-full border border-dashed border-neutral-300 rounded-lg py-6 px-4 flex flex-col items-center justify-center gap-2 hover:border-primary-container hover:bg-primary-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Icon name="upload_file" className="text-3xl text-outline" />
                <span className="text-sm font-semibold text-on-surface">
                  {fileName ? `Đã chọn: ${fileName}` : 'Chọn tệp CSV để tải lên'}
                </span>
                <span className="text-xs text-on-surface-variant">
                  Hoặc kéo & thả tệp vào nút này
                </span>
              </button>
            </div>

            {parseError && (
              <div
                role="alert"
                className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger-50 border border-error-container text-error text-sm"
              >
                <Icon name="error" filled className="text-base mt-0.5" />
                <span className="flex-1">{parseError}</span>
              </div>
            )}

            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger-50 border border-error-container text-error text-sm"
              >
                <Icon name="error" filled className="text-base mt-0.5" />
                <span className="flex-1">{submitError}</span>
              </div>
            )}

            {rows.length > 0 && !parseError && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-on-surface">
                    Xem trước · {rows.length} dòng
                    {rows.length > previewRows.length ? ` (chỉ hiện ${previewRows.length} dòng đầu)` : ''}
                  </h3>
                </div>
                <div className="border border-neutral-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 text-xs uppercase text-neutral-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold w-10">#</th>
                        <th className="px-3 py-2 text-left font-semibold">Họ tên</th>
                        <th className="px-3 py-2 text-left font-semibold">Email</th>
                        <th className="px-3 py-2 text-left font-semibold">Vai trò</th>
                        <th className="px-3 py-2 text-left font-semibold">Mật khẩu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {previewRows.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-on-surface-variant">{i + 1}</td>
                          <td className="px-3 py-2 text-on-surface">{r.full_name || '—'}</td>
                          <td className="px-3 py-2 text-on-surface-variant">{r.email || '—'}</td>
                          <td className="px-3 py-2">
                            {r.system_role ? (
                              <Pill tone={r.system_role === 'ADMIN' ? 'primary' : 'neutral'}>
                                {r.system_role}
                              </Pill>
                            ) : (
                              <span className="text-error text-xs">thiếu</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-on-surface-variant">
                            {r.password ? '••••••' : <span className="text-error">thiếu</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

function ResultPanel({ result, originalRows }) {
  if (!result) return null
  const { created = [], failed = [], total = 0 } = result
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3">
          <div className="text-xs text-outline">Tổng</div>
          <div className="text-2xl font-bold text-on-surface">{total}</div>
        </div>
        <div className="bg-success-50 border border-success-600/20 rounded-lg px-4 py-3">
          <div className="text-xs text-success-600">Thành công</div>
          <div className="text-2xl font-bold text-success-600">{created.length}</div>
        </div>
        <div className="bg-danger-50 border border-danger-500/20 rounded-lg px-4 py-3">
          <div className="text-xs text-danger-500">Thất bại</div>
          <div className="text-2xl font-bold text-danger-500">{failed.length}</div>
        </div>
      </div>

      {failed.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-on-surface mb-2">Các dòng lỗi</h3>
          <div className="border border-neutral-200 rounded-lg overflow-x-auto max-h-72 overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-700 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold w-12">Dòng</th>
                  <th className="px-3 py-2 text-left font-semibold">Email</th>
                  <th className="px-3 py-2 text-left font-semibold">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {failed.map((f) => {
                  // index trong response là index trong mảng đã gửi (0-based, bỏ header)
                  // Để hiển thị đúng số dòng trong file CSV gốc cộng thêm 2 (1 cho header + 1 do 1-based)
                  const csvLine = f.index + 2
                  const fallbackEmail = f.email || originalRows[f.index]?.email || '—'
                  return (
                    <tr key={f.index}>
                      <td className="px-3 py-2 text-on-surface-variant">{csvLine}</td>
                      <td className="px-3 py-2 text-on-surface">{fallbackEmail}</td>
                      <td className="px-3 py-2 text-error">{f.error}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-success-50 border border-success-600/20 rounded-lg p-3 text-sm text-success-600 flex items-center gap-2">
          <Icon name="check_circle" filled className="text-base" />
          Tất cả {total} nhân sự đã được nhập thành công.
        </div>
      )}
    </div>
  )
}
