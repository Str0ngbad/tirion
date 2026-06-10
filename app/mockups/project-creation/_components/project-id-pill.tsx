import { ProjectColor, PROJECT_COLOR_MAP } from "../_data";

type Props = {
  projectNumber: string;
  color: ProjectColor | null;
};

export default function ProjectIdPill({ projectNumber, color }: Props) {
  if (!color) {
    return <span className="font-mono">{projectNumber}</span>;
  }

  const meta = PROJECT_COLOR_MAP[color];
  return (
    <span
      className="inline-block rounded px-[0.45em] py-[0.1em] font-mono leading-none"
      style={{ backgroundColor: meta.hex, color: meta.text === "white" ? "#ffffff" : "#000000" }}
    >
      {projectNumber}
    </span>
  );
}
