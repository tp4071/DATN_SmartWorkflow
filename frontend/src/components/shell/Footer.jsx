export function Footer() {
  return (
    <footer className="bg-white border-t border-neutral-200 px-6 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-outline shrink-0">
      <div className="text-on-surface font-semibold">
        © 2026 Smart Workflow – Đồ án tốt nghiệp – ĐHCNHN
      </div>
      <div className="flex gap-4">
        <a className="hover:text-primary-700 transition-colors" href="#">
          Documentation
        </a>
        <a className="hover:text-primary-700 transition-colors" href="#">
          Privacy Policy
        </a>
        <a className="hover:text-primary-700 transition-colors" href="#">
          Support
        </a>
      </div>
    </footer>
  )
}
