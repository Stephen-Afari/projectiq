import logoLight from '../../assets/projectiq-logo.png';
import logoReversed from '../../assets/projectiq-logo-reversed.png';
import mark from '../../assets/projectiq-mark.png';

/**
 * The ProjectIQ brand logo. `onDark` swaps to the reversed (white-on-navy)
 * lockup for dark surfaces; `mark` renders just the icon mark (for tight
 * spaces like the collapsed mobile nav) instead of the full lockup.
 * Height-constrained, width auto — never stretched.
 */
export function Logo({
  onDark = false,
  mark: markOnly = false,
  className = '',
  height = 28,
}: {
  onDark?: boolean;
  mark?: boolean;
  className?: string;
  height?: number;
}) {
  const src = markOnly ? mark : onDark ? logoReversed : logoLight;
  const alt = markOnly ? 'ProjectIQ' : 'ProjectIQ';
  return (
    <img
      src={src}
      alt={alt}
      style={{ height, width: 'auto' }}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
