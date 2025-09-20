import e8Logo from "@assets/E8 LOGO_1756038316799.png"; // TODO: Replace with Kite-branded logo asset

interface LogoProps {
  size?: number;
}

export const EventLinkLogo = ({ size = 48 }: LogoProps) => (
  <img 
    src={e8Logo} 
    alt="Kite EventLink Logo" 
    style={{ width: size, height: size }}
    className="drop-shadow-sm"
    loading="lazy"
    decoding="async"
  />
);