type MascotMood = "curious" | "working" | "ready" | "resting" | "oops";
type MascotSize = "small" | "medium" | "large";

/** A small, original Sandbox guide character for meaningful product states. */
export function SandboxMascot({
  mood = "curious",
  size = "medium",
  className = "",
}: {
  mood?: MascotMood;
  size?: MascotSize;
  className?: string;
}) {
  return (
    <span
      className={`sandbox-mascot mascot-${mood} mascot-${size} ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle className="mascot-orbit" cx="80" cy="80" r="68" stroke="currentColor" strokeDasharray="3 7" strokeWidth="1.5" />
        <path className="mascot-antenna" d="M80 26V15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <circle className="mascot-signal" cx="80" cy="13" r="6" fill="var(--secondary)" stroke="var(--foreground)" strokeWidth="2" />
        <path d="M49 112c-8 6-12 15-10 24 8 2 18-1 25-8M111 112c8 6 12 15 10 24-8 2-18-1-25-8" fill="var(--secondary)" stroke="var(--foreground)" strokeWidth="3" strokeLinejoin="round" />
        <rect x="37" y="31" width="86" height="82" rx="29" fill="var(--primary)" stroke="var(--foreground)" strokeWidth="3" />
        <path d="M50 43c8-7 17-10 30-10 16 0 28 5 36 15" stroke="white" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" />
        <g className="mascot-eyes" fill="var(--foreground)">
          <ellipse cx="64" cy="70" rx="5" ry="7" />
          <ellipse cx="96" cy="70" rx="5" ry="7" />
        </g>
        {mood === "oops" ? (
          <path d="M70 93c4-5 16-5 20 0" stroke="var(--foreground)" strokeWidth="4" strokeLinecap="round" />
        ) : mood === "working" ? (
          <path d="M72 91h16" stroke="var(--foreground)" strokeWidth="4" strokeLinecap="round" />
        ) : mood === "resting" ? (
          <path d="M59 69h10M91 69h10M72 92h16" stroke="var(--foreground)" strokeWidth="4" strokeLinecap="round" />
        ) : (
          <path d="M68 89c6 9 18 9 24 0" stroke="var(--foreground)" strokeWidth="4" strokeLinecap="round" />
        )}
        <circle cx="51" cy="83" r="5" fill="var(--secondary)" opacity=".75" />
        <circle cx="109" cy="83" r="5" fill="var(--secondary)" opacity=".75" />
        {mood === "working" && <path className="mascot-spark" d="m126 43 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" fill="var(--secondary)" />}
        {mood === "ready" && <path d="m127 48 2.5 5.5L135 56l-5.5 2.5L127 64l-2.5-5.5L119 56l5.5-2.5L127 48Z" fill="var(--secondary)" />}
      </svg>
    </span>
  );
}
