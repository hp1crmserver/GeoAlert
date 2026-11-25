interface GeoAlertIconProps {
  className?: string;
}

export default function GeoAlertIcon({ className = 'h-6 w-6' }: GeoAlertIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="16"
        cy="16"
        r="13.5"
        stroke="currentColor"
        strokeWidth="2"
        className="text-sky-600 dark:text-sky-400"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="6.5"
        ry="13.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.45"
        className="text-sky-600 dark:text-sky-400"
      />
      <line
        x1="2.5"
        y1="16"
        x2="29.5"
        y2="16"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.35"
        className="text-sky-600 dark:text-sky-400"
      />
      <path
        d="M4.5 16H9.5L12 10L15 22.5L18.2 7.5L21.2 19L23.2 16H27.5"
        stroke="#F59E0B"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
