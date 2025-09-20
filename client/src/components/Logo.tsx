import e8Logo from "@assets/E8-Logo-Orange-New.png";

interface LogoProps {
  size?: number;
}

export const EventLinkLogo = ({ size = 48 }: LogoProps) => (
  <img 
    src={e8Logo} 
    alt="EventLink Logo" 
    style={{ width: size, height: size }}
    className="drop-shadow-sm"
    loading="lazy"
    decoding="async"
  />
);