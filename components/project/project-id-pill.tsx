export type ProjectColor =
  | "blue" | "lightBlue" | "purple" | "lightPurple"
  | "red" | "pink" | "orange" | "lightOrange"
  | "yellow" | "green" | "lightGreen" | "gray" | "brown";

const COLOR_MAP: Record<ProjectColor, { hex: string; text: "white" | "black" }> = {
  blue:        { hex: "#1d4ed8", text: "white" },
  lightBlue:   { hex: "#7dd3fc", text: "black" },
  purple:      { hex: "#7e22ce", text: "white" },
  lightPurple: { hex: "#d8b4fe", text: "black" },
  red:         { hex: "#dc2626", text: "white" },
  pink:        { hex: "#ec4899", text: "black" },
  orange:      { hex: "#f97316", text: "black" },
  lightOrange: { hex: "#fdba74", text: "black" },
  yellow:      { hex: "#facc15", text: "black" },
  green:       { hex: "#15803d", text: "white" },
  lightGreen:  { hex: "#86efac", text: "black" },
  gray:        { hex: "#4b5563", text: "white" },
  brown:       { hex: "#92400e", text: "white" },
};

type Props = {
  projectNumber: string;
  color: ProjectColor | null;
};

export function ProjectIdPill({ projectNumber, color }: Props) {
  if (!color) {
    return <span className="font-mono">{projectNumber}</span>;
  }

  const meta = COLOR_MAP[color];
  return (
    <span
      className="inline-block rounded px-[0.45em] py-[0.1em] font-mono leading-none"
      style={{ backgroundColor: meta.hex, color: meta.text === "white" ? "#ffffff" : "#000000" }}
    >
      {projectNumber}
    </span>
  );
}
