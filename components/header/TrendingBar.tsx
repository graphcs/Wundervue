import navData from "@/lib/data/wundervue-nav.json";

export function TrendingBar() {
  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-dark"
      style={{
        background: "linear-gradient(130deg, #82ffc5 0%, #94f6ff 80%)",
      }}
    >
      <span>TRENDING</span>
      <div className="flex items-center gap-3">
        <a
          href={navData.social.facebook}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
          className="opacity-80 transition-opacity hover:opacity-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12z" />
          </svg>
        </a>
        <a
          href={navData.social.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="opacity-80 transition-opacity hover:opacity-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.42.36 1.06.42 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.42 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.17-1.06.36-2.23.42-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.42a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.17-.42-.36-1.06-.42-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.42-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.17 1.06-.36 2.23-.42C8.42 2.21 8.8 2.2 12 2.2zm0 1.8c-3.15 0-3.5.01-4.74.07-1.08.05-1.67.23-2.06.38-.52.2-.9.44-1.29.83-.39.39-.63.77-.83 1.29-.15.39-.33.98-.38 2.06-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.05 1.08.23 1.67.38 2.06.2.52.44.9.83 1.29.39.39.77.63 1.29.83.39.15.98.33 2.06.38 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c1.08-.05 1.67-.23 2.06-.38.52-.2.9-.44 1.29-.83.39-.39.63-.77.83-1.29.15-.39.33-.98.38-2.06.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.05-1.08-.23-1.67-.38-2.06a3.46 3.46 0 0 0-.83-1.29 3.46 3.46 0 0 0-1.29-.83c-.39-.15-.98-.33-2.06-.38C15.5 4.01 15.15 4 12 4zm0 3.07a4.93 4.93 0 1 1 0 9.86 4.93 4.93 0 0 1 0-9.86zm0 1.8a3.13 3.13 0 1 0 0 6.26 3.13 3.13 0 0 0 0-6.26zm6.41-1.87a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0z" />
          </svg>
        </a>
        <a
          href={navData.social.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn"
          className="opacity-80 transition-opacity hover:opacity-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.27 2.36 4.27 5.43zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.99 0 1.78-.77 1.78-1.72V1.72C24 .77 23.21 0 22.22 0z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
