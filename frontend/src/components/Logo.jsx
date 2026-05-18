// Octave wordmark — pure-CSS rendering per brand §2.1 priority #2.
// No SVG asset available, so renders the wordmark "OCTAVE" with the brand display font.

export default function Logo({ variant = 'on-dark', size = 22 }) {
  return (
    <span
      className={`octave-logo octave-logo--${variant}`}
      style={{ fontSize: `${size}px` }}
    >
      OCTAVE
    </span>
  );
}
