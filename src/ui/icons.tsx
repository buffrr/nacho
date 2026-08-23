import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

// Icons exported straight from the Nacho v2 Figma (Lucide set). Each icon keeps
// its source viewBox and stroke/fill weights so the geometry matches the design
// exactly; `size` scales the whole glyph and `color` recolors it.
export type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function Frame({
  size,
  vb,
  children,
}: {
  size: number;
  vb: number;
  children: React.ReactNode;
}) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
      {children}
    </Svg>
  );
}

const cap = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

// ── Stroke icons ───────────────────────────────────────────────────────────

export function AtSign({ size = 24, color = "#0E0E12", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M16 8V13C16 13.7956 16.3161 14.5587 16.8787 15.1213C17.4413 15.6839 18.2044 16 19 16C19.7956 16 20.5587 15.6839 21.1213 15.1213C21.6839 14.5587 22 13.7956 22 13V12C22 9.7473 21.2394 7.5606 19.8414 5.79417C18.4434 4.02774 16.49 2.78507 14.2975 2.26751C12.1051 1.74995 9.80213 1.98781 7.76177 2.94255C5.7214 3.8973 4.06316 5.51299 3.05573 7.52786C2.04829 9.54274 1.75068 11.8387 2.2111 14.0439C2.67153 16.249 3.86301 18.2341 5.59253 19.6775C7.32204 21.1209 9.48824 21.9381 11.7402 21.9966C13.9921 22.0552 16.1978 21.3516 18 20"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function Settings({ size = 20, color = "#FFFFFF", strokeWidth = 1.667 }: IconProps) {
  return (
    <Frame size={size} vb={20}>
      <Path
        d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M16.1667 12.5C16.0557 12.7513 16.0226 13.0302 16.0717 13.3005C16.1207 13.5708 16.2496 13.8203 16.4417 14.0167L16.4917 14.0667C16.6465 14.2215 16.7694 14.4053 16.8532 14.6077C16.937 14.81 16.9801 15.0268 16.9801 15.2458C16.9801 15.4648 16.937 15.6817 16.8532 15.884C16.7694 16.0863 16.6465 16.2701 16.4917 16.425C16.3368 16.5798 16.153 16.7027 15.9507 16.7865C15.7483 16.8703 15.5315 16.9134 15.3125 16.9134C15.0935 16.9134 14.8767 16.8703 14.6743 16.7865C14.472 16.7027 14.2882 16.5798 14.1333 16.425L14.0833 16.375C13.8869 16.1829 13.6375 16.054 13.3672 16.005C13.0968 15.956 12.818 15.9891 12.5667 16.1C12.3202 16.2056 12.11 16.381 11.9619 16.6046C11.8139 16.8282 11.7344 17.0902 11.7333 17.3583V17.5C11.7333 17.942 11.5577 18.3659 11.2452 18.6785C10.9326 18.9911 10.5087 19.1667 10.0667 19.1667C9.62464 19.1667 9.20072 18.9911 8.88816 18.6785C8.57559 18.3659 8.4 17.942 8.4 17.5V17.425C8.39355 17.1492 8.30426 16.8817 8.14376 16.6572C7.98325 16.4328 7.75895 16.2619 7.5 16.1667C7.24865 16.0557 6.96984 16.0226 6.69951 16.0717C6.42918 16.1207 6.17973 16.2496 5.98333 16.4417L5.93333 16.4917C5.7785 16.6465 5.59469 16.7694 5.39236 16.8532C5.19004 16.937 4.97319 16.9801 4.75417 16.9801C4.53514 16.9801 4.31829 16.937 4.11597 16.8532C3.91365 16.7694 3.72984 16.6465 3.575 16.4917C3.42015 16.3368 3.29726 16.153 3.21346 15.9507C3.12965 15.7483 3.08655 15.5315 3.08655 15.3125C3.08655 15.0935 3.12965 14.8767 3.21346 14.6743C3.29726 14.472 3.42015 14.2882 3.575 14.1333L3.625 14.0833C3.81711 13.8869 3.94599 13.6375 3.995 13.3672C4.04402 13.0968 4.01093 12.818 3.9 12.5667C3.79436 12.3202 3.61896 12.11 3.39539 11.9619C3.17181 11.8139 2.90982 11.7344 2.64167 11.7333H2.5C2.05797 11.7333 1.63405 11.5577 1.32149 11.2452C1.00893 10.9326 0.833334 10.5087 0.833334 10.0667C0.833334 9.62464 1.00893 9.20072 1.32149 8.88816C1.63405 8.57559 2.05797 8.4 2.5 8.4H2.575C2.85083 8.39355 3.11834 8.30426 3.34275 8.14376C3.56716 7.98325 3.7381 7.75895 3.83333 7.5C3.94426 7.24865 3.97735 6.96984 3.92834 6.69951C3.87932 6.42918 3.75045 6.17973 3.55833 5.98333L3.50833 5.93333C3.35348 5.77848 3.23059 5.59467 3.14679 5.39235C3.06298 5.19003 3.01988 4.97318 3.01988 4.75416C3.01988 4.53514 3.06298 4.31829 3.14679 4.11597C3.23059 3.91365 3.35348 3.72984 3.50833 3.575C3.66318 3.42015 3.84699 3.29726 4.04931 3.21346C4.25163 3.12965 4.46848 3.08655 4.6875 3.08655C4.90652 3.08655 5.12337 3.12965 5.32569 3.21346C5.52801 3.29726 5.71182 3.42015 5.86667 3.575L5.91667 3.625C6.11307 3.81711 6.36251 3.94599 6.63284 3.995C6.90317 4.04402 7.18199 4.01093 7.43333 3.9H7.5C7.74647 3.79436 7.95668 3.61896 8.10474 3.39539C8.25281 3.17181 8.33226 2.90982 8.33333 2.64167V2.5C8.33333 2.05797 8.50893 1.63405 8.82149 1.32149C9.13405 1.00893 9.55797 0.833334 10 0.833334C10.442 0.833334 10.8659 1.00893 11.1785 1.32149C11.4911 1.63405 11.6667 2.05797 11.6667 2.5V2.575C11.6677 2.84316 11.7472 3.10515 11.8953 3.32872C12.0433 3.5523 12.2535 3.7277 12.5 3.83333C12.7513 3.94426 13.0302 3.97735 13.3005 3.92834C13.5708 3.87932 13.8203 3.75045 14.0167 3.55833L14.0667 3.50833C14.2215 3.35348 14.4053 3.23059 14.6076 3.14679C14.81 3.06298 15.0268 3.01988 15.2458 3.01988C15.4649 3.01988 15.6817 3.06298 15.884 3.14679C16.0864 3.23059 16.2702 3.35348 16.425 3.50833C16.5799 3.66318 16.7027 3.84699 16.7865 4.04931C16.8703 4.25163 16.9134 4.46848 16.9134 4.6875C16.9134 4.90652 16.8703 5.12337 16.7865 5.32569C16.7027 5.52801 16.5799 5.71182 16.425 5.86667L16.375 5.91667C16.1829 6.11307 16.054 6.36251 16.005 6.63284C15.956 6.90317 15.9891 7.18199 16.1 7.43333V7.5C16.2056 7.74647 16.381 7.95668 16.6046 8.10474C16.8282 8.25281 17.0902 8.33226 17.3583 8.33333H17.5C17.942 8.33333 18.3659 8.50893 18.6785 8.82149C18.9911 9.13405 19.1667 9.55797 19.1667 10C19.1667 10.442 18.9911 10.8659 18.6785 11.1785C18.3659 11.4911 17.942 11.6667 17.5 11.6667H17.425C17.1568 11.6677 16.8949 11.7472 16.6713 11.8953C16.4477 12.0433 16.2723 12.2535 16.1667 12.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function Plus({ size = 20, color = "#FFFFFF", strokeWidth = 1.667 }: IconProps) {
  return (
    <Frame size={size} vb={20}>
      <Path d="M4.16667 10H15.8333" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M10 4.16667V15.8333" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function ChevronRight({ size = 18, color = "#B8B8BF", strokeWidth = 1.5 }: IconProps) {
  return (
    <Frame size={size} vb={18}>
      <Path d="M6.75 13.5L11.25 9L6.75 4.5" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function ArrowLeft({ size = 22, color = "#0E0E12", strokeWidth = 1.833 }: IconProps) {
  return (
    <Frame size={size} vb={22}>
      <Path d="M13.75 16.5L8.25 11L13.75 5.5" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function ShoppingBag({ size = 24, color = "#111114", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M3 6H21" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path
        d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function ArrowLeftRight({ size = 24, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path d="M8 3L4 7L8 11" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M4 7H20" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M16 21L20 17L16 13" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M20 17H4" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function ShieldCheck({ size = 24, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M20 13C20 18 16.5 20.5 12.34 21.95C12.1222 22.0238 11.8855 22.0202 11.67 21.94C7.5 20.5 4 18 4 13V6C4 5.73478 4.10536 5.48043 4.29289 5.29289C4.48043 5.10536 4.73478 5 5 5C7 5 9.5 3.8 11.24 2.28C11.4519 2.09901 11.7214 1.99958 12 1.99958C12.2786 1.99958 12.5481 2.09901 12.76 2.28C14.51 3.81 17 5 19 5C19.2652 5 19.5196 5.10536 19.7071 5.29289C19.8946 5.48043 20 5.73478 20 6V13Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M9 12L11 14L15 10"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function Clock({ size = 18, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M12 6V12L16 14" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function ScanIcon({ size = 24, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M3 7V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H7"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M17 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V7"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M21 17V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H17"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M7 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V17"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M7 12H17" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function Copy({ size = 16, color = "#9A9AA0", strokeWidth = 1.333 }: IconProps) {
  return (
    <Frame size={size} vb={16}>
      <Path
        d="M13.3333 5.33325H6.66659C5.93021 5.33325 5.33325 5.93021 5.33325 6.66659V13.3333C5.33325 14.0696 5.93021 14.6666 6.66659 14.6666H13.3333C14.0696 14.6666 14.6666 14.0696 14.6666 13.3333V6.66659C14.6666 5.93021 14.0696 5.33325 13.3333 5.33325Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M2.66659 10.6666C1.93325 10.6666 1.33325 10.0666 1.33325 9.33325V2.66659C1.33325 1.93325 1.93325 1.33325 2.66659 1.33325H9.33325C10.0666 1.33325 10.6666 1.93325 10.6666 2.66659"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function Pencil({ size = 16, color = "#9A9AA0", strokeWidth = 1.333 }: IconProps) {
  return (
    <Frame size={size} vb={16}>
      <Path d="M8 13.3333H14" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path
        d="M11 2.3334C11.2652 2.06819 11.6249 1.91919 12 1.91919C12.1857 1.91919 12.3696 1.95577 12.5412 2.02684C12.7128 2.09791 12.8687 2.20208 13 2.3334C13.1313 2.46472 13.2355 2.62063 13.3066 2.79221C13.3776 2.96379 13.4142 3.14769 13.4142 3.3334C13.4142 3.51912 13.3776 3.70302 13.3066 3.8746C13.2355 4.04618 13.1313 4.20208 13 4.3334L4.66667 12.6667L2 13.3334L2.66667 10.6667L11 2.3334Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function Lock({ size = 16, color = "#9A9AA0", strokeWidth = 1.333 }: IconProps) {
  return (
    <Frame size={size} vb={16}>
      <Path
        d="M12.6667 7.33325H3.33333C2.59695 7.33325 2 7.93021 2 8.66659V13.3333C2 14.0696 2.59695 14.6666 3.33333 14.6666H12.6667C13.403 14.6666 14 14.0696 14 13.3333V8.66659C14 7.93021 13.403 7.33325 12.6667 7.33325Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M4.66675 7.33325V4.66659C4.66675 3.78253 5.01794 2.93468 5.64306 2.30956C6.26818 1.68444 7.11603 1.33325 8.00008 1.33325C8.88414 1.33325 9.73198 1.68444 10.3571 2.30956C10.9822 2.93468 11.3334 3.78253 11.3334 4.66659V7.33325"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function X({ size = 16, color = "#9A9AA0", strokeWidth = 1.333 }: IconProps) {
  return (
    <Frame size={size} vb={16}>
      <Path d="M12 4L4 12" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M4 4L12 12" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function Search({ size = 20, color = "#9A9AA0", strokeWidth = 1.667 }: IconProps) {
  return (
    <Frame size={size} vb={20}>
      <Path
        d="M9.16667 15.8333C12.8486 15.8333 15.8333 12.8486 15.8333 9.16667C15.8333 5.48477 12.8486 2.5 9.16667 2.5C5.48477 2.5 2.5 5.48477 2.5 9.16667C2.5 12.8486 5.48477 15.8333 9.16667 15.8333Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M17.5 17.5001L13.9167 13.9167" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function Check({ size = 14, color = "#1B8C49", strokeWidth = 1.167 }: IconProps) {
  return (
    <Frame size={size} vb={14}>
      <Path
        d="M11.6667 3.5L5.25004 9.91667L2.33337 7"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function Clipboard({ size = 20, color = "#0E0E12", strokeWidth = 1.667 }: IconProps) {
  return (
    <Frame size={size} vb={20}>
      <Path
        d="M12.5 1.6665H7.49996C7.03972 1.6665 6.66663 2.0396 6.66663 2.49984V4.1665C6.66663 4.62674 7.03972 4.99984 7.49996 4.99984H12.5C12.9602 4.99984 13.3333 4.62674 13.3333 4.1665V2.49984C13.3333 2.0396 12.9602 1.6665 12.5 1.6665Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M13.3334 3.3335H15C15.4421 3.3335 15.866 3.50909 16.1786 3.82165C16.4911 4.13421 16.6667 4.55814 16.6667 5.00016V16.6668C16.6667 17.1089 16.4911 17.5328 16.1786 17.8453C15.866 18.1579 15.4421 18.3335 15 18.3335H5.00004C4.55801 18.3335 4.13409 18.1579 3.82153 17.8453C3.50897 17.5328 3.33337 17.1089 3.33337 16.6668V5.00016C3.33337 4.55814 3.50897 4.13421 3.82153 3.82165C4.13409 3.50909 4.55801 3.3335 5.00004 3.3335H6.66671"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function Anchor({ size = 18, color = "#0E0E12", strokeWidth = 1.5 }: IconProps) {
  return (
    <Frame size={size} vb={18}>
      <Path
        d="M9 6C10.2426 6 11.25 4.99264 11.25 3.75C11.25 2.50736 10.2426 1.5 9 1.5C7.75736 1.5 6.75 2.50736 6.75 3.75C6.75 4.99264 7.75736 6 9 6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M9 16.5V6" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path
        d="M3.75 9H1.5C1.5 10.9891 2.29018 12.8968 3.6967 14.3033C5.10322 15.7098 7.01088 16.5 9 16.5C10.9891 16.5 12.8968 15.7098 14.3033 14.3033C15.7098 12.8968 16.5 10.9891 16.5 9H14.25"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function AlertCircle({ size = 18, color = "#0E0E12", strokeWidth = 1.5 }: IconProps) {
  return (
    <Frame size={size} vb={18}>
      <Path
        d="M9 16.5C13.1421 16.5 16.5 13.1421 16.5 9C16.5 4.85786 13.1421 1.5 9 1.5C4.85786 1.5 1.5 4.85786 1.5 9C1.5 13.1421 4.85786 16.5 9 16.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M9 6V9" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M9 12H9.0075" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function QrCode({ size = 17, color = "#FFFFFF", strokeWidth = 1.417 }: IconProps) {
  return (
    <Frame size={size} vb={17}>
      <Path
        d="M6.375 2.125H2.83333C2.44213 2.125 2.125 2.44213 2.125 2.83333V6.375C2.125 6.7662 2.44213 7.08333 2.83333 7.08333H6.375C6.7662 7.08333 7.08333 6.7662 7.08333 6.375V2.83333C7.08333 2.44213 6.7662 2.125 6.375 2.125Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M14.1667 2.125H10.625C10.2338 2.125 9.91666 2.44213 9.91666 2.83333V6.375C9.91666 6.7662 10.2338 7.08333 10.625 7.08333H14.1667C14.5579 7.08333 14.875 6.7662 14.875 6.375V2.83333C14.875 2.44213 14.5579 2.125 14.1667 2.125Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M6.375 9.9165H2.83333C2.44213 9.9165 2.125 10.2336 2.125 10.6248V14.1665C2.125 14.5577 2.44213 14.8748 2.83333 14.8748H6.375C6.7662 14.8748 7.08333 14.5577 7.08333 14.1665V10.6248C7.08333 10.2336 6.7662 9.9165 6.375 9.9165Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M9.91666 9.9165H12.0417V12.0415" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M14.875 9.9165V14.8748H9.91666" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function Download({ size = 18, color = "#0E0E12", strokeWidth = 1.5 }: IconProps) {
  return (
    <Frame size={size} vb={18}>
      <Path
        d="M15.75 11.25V14.25C15.75 14.6478 15.592 15.0294 15.3107 15.3107C15.0294 15.592 14.6478 15.75 14.25 15.75H3.75C3.35218 15.75 2.97064 15.592 2.68934 15.3107C2.40804 15.0294 2.25 14.6478 2.25 14.25V11.25"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M5.25 7.5L9 11.25L12.75 7.5" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M9 11.25V2.25" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function Upload({ size = 18, color = "#0E0E12", strokeWidth = 1.5 }: IconProps) {
  return (
    <Frame size={size} vb={18}>
      <Path
        d="M15.75 11.25V14.25C15.75 14.6478 15.592 15.0294 15.3107 15.3107C15.0294 15.592 14.6478 15.75 14.25 15.75H3.75C3.35218 15.75 2.97064 15.592 2.68934 15.3107C2.40804 15.0294 2.25 14.6478 2.25 14.25V11.25"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M5.25 6.75L9 3L12.75 6.75" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M9 3V11.25" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function Eye({ size = 18, color = "#0E0E12", strokeWidth = 1.5 }: IconProps) {
  return (
    <Frame size={size} vb={18}>
      <Path
        d="M1.5 9C1.5 9 3.75 3.75 9 3.75C14.25 3.75 16.5 9 16.5 9C16.5 9 14.25 14.25 9 14.25C3.75 14.25 1.5 9 1.5 9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M9 11.25C10.2426 11.25 11.25 10.2426 11.25 9C11.25 7.75736 10.2426 6.75 9 6.75C7.75736 6.75 6.75 7.75736 6.75 9C6.75 10.2426 7.75736 11.25 9 11.25Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

// ── Record / payment-type icons (Lucide) ────────────────────────────────────

export function Bitcoin({ size = 20, color = "#F7931A", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function Zap({ size = 20, color = "#F5A623" }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"
        fill={color}
      />
    </Frame>
  );
}

export function EyeOff({ size = 20, color = "#8B5CF6", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path
        d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="m2 2 20 20" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function Droplet({ size = 20, color = "#2563EB", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function FileText({ size = 20, color = "#64748B", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M14 2v5a1 1 0 0 0 1 1h5" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M10 9H8" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M16 13H8" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M16 17H8" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function Binary({ size = 20, color = "#64748B", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Rect x="14" y="14" width="4" height="6" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Rect x="6" y="4" width="4" height="6" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M6 20h4" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M14 10h4" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M6 14h2v6" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M14 4h2v6" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

// The Nacho brand mark — the rounded triangle from the wordmark logo. Uses an
// offset viewBox tight around the triangle so it centers in a square. Pass
// `stroke` for an outlined (clickable-looking) icon; omit for the solid mark.
export function NachoMark({
  size = 20,
  color = "#FF7B00",
  stroke = false,
  strokeWidth = 12,
}: IconProps & { stroke?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="30 -12 164 164" fill="none">
      <Path
        d="M36.239 21.244C31.0838 9.82436 41.3339 -2.52292 53.5024 0.448335L179.208 31.1425C190.465 33.8911 194.511 47.8102 186.482 56.1681L110.391 135.379C103.02 143.052 90.2317 140.848 85.8535 131.149L36.239 21.244Z"
        fill={stroke ? "none" : color}
        stroke={stroke ? color : undefined}
        strokeWidth={stroke ? strokeWidth : undefined}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Infinity({ size = 20, color = "#64748B", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function Trash({ size = 20, color = "#E5484D", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6M10 11v6M14 11v6"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function Hash({ size = 20, color = "#64748B", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path d="M4 9H20" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M4 15H20" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M10 3L8 21" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M16 3L14 21" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

// ── Fill icons ─────────────────────────────────────────────────────────────

export function MoreVertical({ size = 20, color = "#A6A6AC" }: IconProps) {
  return (
    <Frame size={size} vb={20}>
      <Path
        d="M10 5.58333C10.7824 5.58333 11.4167 4.94907 11.4167 4.16667C11.4167 3.38426 10.7824 2.75 10 2.75C9.2176 2.75 8.58333 3.38426 8.58333 4.16667C8.58333 4.94907 9.2176 5.58333 10 5.58333Z"
        fill={color}
      />
      <Path
        d="M10 11.4167C10.7824 11.4167 11.4167 10.7824 11.4167 10C11.4167 9.2176 10.7824 8.58333 10 8.58333C9.2176 8.58333 8.58333 9.2176 8.58333 10C8.58333 10.7824 9.2176 11.4167 10 11.4167Z"
        fill={color}
      />
      <Path
        d="M10 17.25C10.7824 17.25 11.4167 16.6157 11.4167 15.8333C11.4167 15.0509 10.7824 14.4167 10 14.4167C9.2176 14.4167 8.58333 15.0509 8.58333 15.8333C8.58333 16.6157 9.2176 17.25 10 17.25Z"
        fill={color}
      />
    </Frame>
  );
}

export function Storefront({ size = 32, color = "#0E0E12" }: IconProps) {
  return (
    <Frame size={size} vb={32}>
      <Path
        d="M29 12C29.0005 11.907 28.9879 11.8144 28.9625 11.725L27.1687 5.45C27.0482 5.03364 26.7962 4.66745 26.4504 4.40612C26.1045 4.14478 25.6835 4.00232 25.25 4H6.75C6.31654 4.00232 5.89547 4.14478 5.54964 4.40612C5.20382 4.66745 4.95181 5.03364 4.83125 5.45L3.03875 11.725C3.01293 11.8144 2.99988 11.907 3 12V14C3 14.7762 3.18073 15.5418 3.52786 16.2361C3.875 16.9303 4.37902 17.5343 5 18V27C5 27.2652 5.10536 27.5196 5.29289 27.7071C5.48043 27.8946 5.73478 28 6 28H26C26.2652 28 26.5196 27.8946 26.7071 27.7071C26.8946 27.5196 27 27.2652 27 27V18C27.621 17.5343 28.125 16.9303 28.4721 16.2361C28.8193 15.5418 29 14.7762 29 14V12ZM6.75 6H25.25L26.6775 11H5.32625L6.75 6ZM13 13H19V14C19 14.7956 18.6839 15.5587 18.1213 16.1213C17.5587 16.6839 16.7956 17 16 17C15.2044 17 14.4413 16.6839 13.8787 16.1213C13.3161 15.5587 13 14.7956 13 14V13ZM11 13V14C10.9998 14.5159 10.8666 15.023 10.6132 15.4724C10.3599 15.9217 9.9949 16.2982 9.55358 16.5653C9.11226 16.8325 8.6095 16.9813 8.09387 16.9975C7.57825 17.0136 7.06717 16.8965 6.61 16.6575C6.54044 16.6034 6.46392 16.5588 6.3825 16.525C5.95884 16.2538 5.61019 15.8804 5.36861 15.4392C5.12702 14.9979 5.00027 14.503 5 14V13H11ZM25 26H7V18.9C7.3292 18.9664 7.66418 18.9999 8 19C8.77623 19 9.54179 18.8193 10.2361 18.4721C10.9303 18.125 11.5343 17.621 12 17C12.4657 17.621 13.0697 18.125 13.7639 18.4721C14.4582 18.8193 15.2238 19 16 19C16.7762 19 17.5418 18.8193 18.2361 18.4721C18.9303 18.125 19.5343 17.621 20 17C20.4657 17.621 21.0697 18.125 21.7639 18.4721C22.4582 18.8193 23.2238 19 24 19C24.3358 18.9999 24.6708 18.9664 25 18.9V26ZM25.6162 16.525C25.5359 16.5589 25.4603 16.603 25.3912 16.6562C24.9341 16.8955 24.423 17.0129 23.9073 16.9969C23.3916 16.981 22.8887 16.8323 22.4473 16.5653C22.0058 16.2982 21.6407 15.9218 21.3872 15.4725C21.1336 15.0231 21.0003 14.516 21 14V13H27V14C26.9996 14.5032 26.8727 14.9981 26.6308 15.4394C26.389 15.8806 26.0401 16.2539 25.6162 16.525Z"
        fill={color}
      />
    </Frame>
  );
}

export function Ticket({ size = 32, color = "#0E0E12" }: IconProps) {
  return (
    <Frame size={size} vb={32}>
      <Path
        d="M29 13C29.2652 13 29.5196 12.8946 29.7071 12.7071C29.8946 12.5196 30 12.2652 30 12V8C30 7.46957 29.7893 6.96086 29.4142 6.58579C29.0391 6.21071 28.5304 6 28 6H4C3.46957 6 2.96086 6.21071 2.58579 6.58579C2.21071 6.96086 2 7.46957 2 8V12C2 12.2652 2.10536 12.5196 2.29289 12.7071C2.48043 12.8946 2.73478 13 3 13C3.79565 13 4.55871 13.3161 5.12132 13.8787C5.68393 14.4413 6 15.2044 6 16C6 16.7956 5.68393 17.5587 5.12132 18.1213C4.55871 18.6839 3.79565 19 3 19C2.73478 19 2.48043 19.1054 2.29289 19.2929C2.10536 19.4804 2 19.7348 2 20V24C2 24.5304 2.21071 25.0391 2.58579 25.4142C2.96086 25.7893 3.46957 26 4 26H28C28.5304 26 29.0391 25.7893 29.4142 25.4142C29.7893 25.0391 30 24.5304 30 24V20C30 19.7348 29.8946 19.4804 29.7071 19.2929C29.5196 19.1054 29.2652 19 29 19C28.2044 19 27.4413 18.6839 26.8787 18.1213C26.3161 17.5587 26 16.7956 26 16C26 15.2044 26.3161 14.4413 26.8787 13.8787C27.4413 13.3161 28.2044 13 29 13ZM4 20.9C5.13029 20.6705 6.14647 20.0573 6.87638 19.1643C7.60628 18.2712 8.00501 17.1534 8.00501 16C8.00501 14.8466 7.60628 13.7288 6.87638 12.8357C6.14647 11.9427 5.13029 11.3295 4 11.1V8H11V24H4V20.9ZM28 20.9V24H13V8H28V11.1C26.8697 11.3295 25.8535 11.9427 25.1236 12.8357C24.3937 13.7288 23.995 14.8466 23.995 16C23.995 17.1534 24.3937 18.2712 25.1236 19.1643C25.8535 20.0573 26.8697 20.6705 28 20.9Z"
        fill={color}
      />
    </Frame>
  );
}

export function Key({ size = 32, color = "#0E0E12" }: IconProps) {
  return (
    <Frame size={size} vb={32}>
      <Path
        d="M27.0713 4.92874C25.4828 3.33812 23.4048 2.32908 21.1726 2.06443C18.9403 1.79979 16.684 2.29497 14.7677 3.47009C12.8514 4.6452 11.3869 6.43169 10.6106 8.54129C9.83423 10.6509 9.79132 12.9605 10.4888 15.0975L3.58625 22C3.39973 22.185 3.25184 22.4053 3.1512 22.648C3.05056 22.8907 2.99916 23.151 3 23.4137V27C3 27.5304 3.21071 28.0391 3.58579 28.4142C3.96086 28.7893 4.46957 29 5 29H9C9.26522 29 9.51957 28.8946 9.70711 28.7071C9.89464 28.5196 10 28.2652 10 28V26H12C12.2652 26 12.5196 25.8946 12.7071 25.7071C12.8946 25.5196 13 25.2652 13 25V23H15C15.1314 23.0001 15.2615 22.9743 15.3829 22.9241C15.5042 22.8739 15.6146 22.8003 15.7075 22.7075L16.9025 21.5112C17.9027 21.8366 18.9482 22.0015 20 22H20.0125C21.9893 21.9976 23.921 21.4094 25.5637 20.3096C27.2063 19.2098 28.4862 17.6479 29.2415 15.8211C29.9969 13.9943 30.1939 11.9846 29.8076 10.0459C29.4213 8.10723 28.4691 6.32651 27.0713 4.92874ZM28 12.2625C27.8638 16.5237 24.2812 19.995 20.0138 20H20C18.9877 20.0017 17.9844 19.8104 17.0438 19.4362C16.8597 19.3564 16.656 19.3337 16.4589 19.3712C16.2619 19.4086 16.0806 19.5044 15.9388 19.6462L14.5863 21H12C11.7348 21 11.4804 21.1053 11.2929 21.2929C11.1054 21.4804 11 21.7348 11 22V24H9C8.73478 24 8.48043 24.1053 8.29289 24.2929C8.10536 24.4804 8 24.7348 8 25V27H5V23.4137L12.3538 16.0612C12.4955 15.9194 12.5914 15.7381 12.6288 15.5411C12.6663 15.344 12.6436 15.1402 12.5638 14.9562C12.1884 14.0125 11.9971 13.0056 12 11.99C12 7.72249 15.4762 4.13999 19.7375 4.00374C20.8321 3.96721 21.9225 4.15582 22.9413 4.55788C23.96 4.95995 24.8853 5.5669 25.6599 6.34115C26.4345 7.1154 27.0419 8.04044 27.4444 9.05899C27.8469 10.0775 28.036 11.1679 28 12.2625ZM24 9.49999C24 9.79666 23.912 10.0867 23.7472 10.3333C23.5824 10.58 23.3481 10.7723 23.074 10.8858C22.7999 10.9993 22.4983 11.029 22.2074 10.9712C21.9164 10.9133 21.6491 10.7704 21.4393 10.5606C21.2296 10.3509 21.0867 10.0836 21.0288 9.79262C20.9709 9.50165 21.0007 9.20005 21.1142 8.92596C21.2277 8.65187 21.42 8.41761 21.6666 8.25278C21.9133 8.08796 22.2033 7.99999 22.5 7.99999C22.8978 7.99999 23.2794 8.15802 23.5607 8.43933C23.842 8.72063 24 9.10216 24 9.49999Z"
        fill={color}
      />
    </Frame>
  );
}

// ── mocks2 additions: resolve/records views ─────────────────────────────────

export function Globe({ size = 24, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M2 12H22" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2Z" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function ExternalLink({ size = 18, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path d="M15 3H21V9" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M10 14L21 3" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function ChevronDown({ size = 18, color = "#B8B8BF", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path d="M6 9L12 15L18 9" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function ChevronUp({ size = 18, color = "#B8B8BF", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path d="M18 15L12 9L6 15" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function ShieldX({ size = 24, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M9.5 9L14.5 14" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M14.5 9L9.5 14" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function WifiOff({ size = 24, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path d="M2 2L22 22" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M8.5 16.5C9.5 15.6 10.7 15 12 15C13.3 15 14.5 15.6 15.5 16.5" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M5 12.5C5.9 11.6 6.95 10.9 8.1 10.45" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M19 12.5C18.1 11.6 17.05 10.9 15.9 10.45" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M2 8.82C3.5 7.6 5.2 6.7 7 6.15" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M22 8.82C20.7 7.76 19.24 6.94 17.68 6.4" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M12 20H12.01" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function SearchX({ size = 24, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path d="M13.5 8.5L8.5 13.5" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M8.5 8.5L13.5 13.5" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M21 21L16.65 16.65" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function RefreshCw({ size = 18, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path d="M21 2V8H15" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M3 12C3 7.02944 7.02944 3 12 3C14.8273 3 17.35 4.30367 19 6.34267L21 8" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M3 22V16H9" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M21 12C21 16.9706 16.9706 21 12 21C9.17273 21 6.65 19.6963 5 17.6573L3 16" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function Terminal({ size = 24, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path d="M4 17L10 11L4 5" stroke={color} strokeWidth={strokeWidth} {...cap} />
      <Path d="M12 19H20" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

export function Link({ size = 20, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
    </Frame>
  );
}

export function KeyRound({ size = 20, color = "#9A9AA0", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...cap}
      />
      <Path d="M16.5 7.5h.01" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}

// ── Brand / social icons (Simple Icons geometry, single-fill glyphs) ─────────
// Trademarks of their respective owners; used here only to label a link to that
// service. Monochrome so they tint with the record color and read on any theme.

export function XTwitter({ size = 20, color = "#0E0E12" }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
        fill={color}
      />
    </Frame>
  );
}

export function Instagram({ size = 20, color = "#E1306C" }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
        fill={color}
      />
    </Frame>
  );
}

export function Mastodon({ size = 20, color = "#6364FF" }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 00.023-.043v-1.809a.052.052 0 00-.02-.041.053.053 0 00-.046-.01 20.282 20.282 0 01-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 01-.319-1.433.053.053 0 01.066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.504 2.962 1.51l.638 1.073.638-1.073c.66-1.006 1.65-1.51 2.96-1.51 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"
        fill={color}
      />
    </Frame>
  );
}

export function Telegram({ size = 20, color = "#229ED9" }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
        fill={color}
      />
    </Frame>
  );
}

export function Discord({ size = 20, color = "#5865F2" }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9459 2.4189-2.1568 2.4189Z"
        fill={color}
      />
    </Frame>
  );
}

export function Github({ size = 20, color = "#8A857E" }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Path
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
        fill={color}
      />
    </Frame>
  );
}

export function Mail({ size = 20, color = "#5B9BD5", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size} vb={24}>
      <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M22 7L13.03 12.7C12.7213 12.8934 12.3643 12.996 12 12.996C11.6357 12.996 11.2787 12.8934 10.97 12.7L2 7" stroke={color} strokeWidth={strokeWidth} {...cap} />
    </Frame>
  );
}
