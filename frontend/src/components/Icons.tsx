import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const I = ({ size = 16, className = "", children, ...rest }: IconProps & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...rest}
  >
    {children}
  </svg>
);

export const IGraph = (p: IconProps) => <I {...p}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.6 7.6 10.4 16M16.4 7.6 13.6 16"/></I>;
export const IArticle = (p: IconProps) => <I {...p}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></I>;
export const ISearch = (p: IconProps) => <I {...p}><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></I>;
export const ISpark = (p: IconProps) => <I {...p}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></I>;
export const IBell = (p: IconProps) => <I {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/></I>;
export const ISettings = (p: IconProps) => <I {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></I>;
export const IUser = (p: IconProps) => <I {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></I>;
export const IChevron = (p: IconProps) => <I {...p}><path d="m6 9 6 6 6-6"/></I>;
export const IPlus = (p: IconProps) => <I {...p}><path d="M12 5v14M5 12h14"/></I>;
export const ILogIn = (p: IconProps) => <I {...p}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/></I>;
export const ILogOut = (p: IconProps) => <I {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></I>;
export const IExternal = (p: IconProps) => <I {...p}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></I>;
export const IInfo = (p: IconProps) => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></I>;
export const IBook = (p: IconProps) => <I {...p}><path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20v5H6.5A2.5 2.5 0 0 1 4 19.5z"/></I>;
export const IHome = (p: IconProps) => <I {...p}><path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></I>;
export const ICheck = (p: IconProps) => <I {...p}><path d="M4 12l5 5L20 6"/></I>;
export const IClock = (p: IconProps) => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></I>;
export const ITrend = (p: IconProps) => <I {...p}><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></I>;
export const ITag = (p: IconProps) => <I {...p}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1"/></I>;
