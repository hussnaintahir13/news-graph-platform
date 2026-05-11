export default function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 text-xs text-muted flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          © {new Date().getFullYear()} <strong className="text-slate-700">Syed Hussnain Tahir Sherazi</strong>. All rights reserved.
          <span className="hidden md:inline"> · </span>
          <br className="md:hidden"/>
          Unauthorised reproduction, distribution or commercial use is prohibited.
        </div>
        <div className="text-[11px]">
          For licensing or permission to use, please <a className="link" href="mailto:hussnaintahir13@users.noreply.github.com">contact the author</a>.
        </div>
      </div>
    </footer>
  );
}
