import stravaLogo from "@/assets/api_logo_pwrdBy_strava_horiz_orange.png";

interface FooterProps {
  language: "en" | "id";
  className?: string;
}

export function Footer({ language, className = "" }: FooterProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-center gap-2 mt-4 text-muted-foreground ${className}`}
    >
      {/* Strava logo - on its own row on small screens */}
      <div className="flex justify-center sm:justify-start">
        <img
          src={stravaLogo}
          alt="Powered by Strava"
          className="h-4 w-auto sm:ml-2"
        />
      </div>

      {/* Separator - only visible on large screens */}
      <span className="hidden sm:inline text-brand-pink">|</span>

      {/* Developer info - stays together in one row on small screens */}
      <div className="flex items-center justify-center gap-2">
        <span>{language === "en" ? "developed by" : "dikembangkan oleh"}</span>
        <a
          href="https://instagram.com/fauzanebd"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-brand-green hover:text-brand-pink font-medium transition-colors"
        >
          fauzanebd
        </a>
        <span className="text-brand-pink">|</span>
        <a
          href="https://github.com/fauzanebd/pinggerr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-brand-green hover:text-brand-pink font-medium transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={18}
            height={18}
            fill="currentColor"
            viewBox="0 0 24 24"
            className="inline-block"
            aria-hidden="true"
          >
            <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.76-1.606-2.665-.304-5.466-1.334-5.466-5.931 0-1.31.468-2.381 1.235-3.221-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23a11.52 11.52 0 0 1 3.003-.404c1.02.005 2.047.138 3.003.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.653.242 2.873.119 3.176.77.84 1.234 1.911 1.234 3.221 0 4.609-2.804 5.625-5.475 5.921.43.372.813 1.104.813 2.226 0 1.606-.015 2.898-.015 3.293 0 .321.218.694.825.576C20.565 21.796 24 17.299 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
          github
        </a>
      </div>
    </div>
  );
}
