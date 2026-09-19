import { ReactNode } from 'react';
import { ProfileColour } from '../db';

/**
 * The only way a profile colour is ever shown: a small dot beside a name. Never card-sized,
 * never spoken — a chord's colour is the child's answer identity and this must not look like
 * one. Decorative, so hidden from assistive technology.
 */
export default function ProfileDot({
  colorHex,
  className = 'w-3 h-3',
  children,
}: {
  colorHex: ProfileColour;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={`rounded-full shrink-0 inline-flex items-center justify-center ${className}`}
      style={{ backgroundColor: colorHex }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
