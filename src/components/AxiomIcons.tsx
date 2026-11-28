/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
}

/**
 * Axiom Geometric Brand Mark (1.5px stroke, coordinate hyperbola manifold)
 */
export function AxiomBrandLogo({ className = 'w-6 h-6', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect x="2" y="2" width="28" height="28" rx="8" fill="#080B10" stroke="#182232" strokeWidth="1.5" />
      <path d="M8 16H24M16 8V24" stroke="#1C2738" strokeWidth="1" strokeDasharray="2 2" />
      <path
        d="M10 20C13.5 20 14.5 12 16 12C17.5 12 18.5 20 22 20C24.5 20 25.5 17.5 25.5 16C25.5 14.5 24.5 12 22 12C18.5 12 17.5 20 16 20C14.5 20 13.5 12 10 12C7.5 12 6.5 14.5 6.5 16C6.5 17.5 7.5 20 10 20Z"
        stroke="#22D3EE"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="1.75" fill="#F59E0B" />
      <circle cx="10" cy="16" r="1.25" fill="#22D3EE" />
      <circle cx="22" cy="16" r="1.25" fill="#22D3EE" />
    </svg>
  );
}

/**
 * Bespoke 1.25px stroke duotone Calculator Icon with integral facet
 */
export function DuotoneCalculatorIcon({ className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect x="3.5" y="2.5" width="17" height="19" rx="3.5" fill="#22D3EE" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.25" />
      <rect x="6" y="5.5" width="12" height="4" rx="1.5" fill="#05070B" stroke="currentColor" strokeWidth="1.25" />
      {/* Key Matrix Dots */}
      <circle cx="7.5" cy="13.5" r="1" fill="currentColor" />
      <circle cx="12" cy="13.5" r="1" fill="currentColor" />
      <circle cx="16.5" cy="13.5" r="1" fill="currentColor" />
      <circle cx="7.5" cy="17.5" r="1" fill="currentColor" />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" />
      {/* Precision Equal Key Accent */}
      <rect x="15" y="16.5" width="3" height="2" rx="0.5" fill="#F59E0B" />
    </svg>
  );
}

/**
 * Bespoke 1.25px stroke duotone Graph / Manifold Icon
 */
export function DuotoneGraphIcon({ className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="3.5" fill="#22D3EE" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.25" />
      <path d="M6 18V6M6 18H18" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path
        d="M6 15C9 15 10 9 13 9C15 9 16 13 18 8"
        stroke="#22D3EE"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="13" cy="9" r="1.5" fill="#F59E0B" />
    </svg>
  );
}

/**
 * Bespoke 1.25px stroke duotone STEM / Atom Orbital Icon
 */
export function DuotoneStemIcon({ className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="2.5" fill="#F59E0B" />
      <ellipse cx="12" cy="12" rx="8.5" ry="3.5" transform="rotate(30 12 12)" stroke="currentColor" strokeWidth="1.25" />
      <ellipse cx="12" cy="12" rx="8.5" ry="3.5" transform="rotate(-30 12 12)" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="18" cy="8.5" r="1" fill="#22D3EE" />
      <circle cx="6" cy="15.5" r="1" fill="#22D3EE" />
    </svg>
  );
}

/**
 * Bespoke 1.25px stroke duotone CAD Isometric Cube Icon
 */
export function DuotoneCadIcon({ className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Top Facet */}
      <path d="M12 2.5L20 7.5L12 12.5L4 7.5L12 2.5Z" fill="#22D3EE" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      {/* Left & Right Facets */}
      <path d="M4 7.5V16.5L12 21.5V12.5L4 7.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M12 12.5V21.5L20 16.5V7.5L12 12.5Z" fill="#F59E0B" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      {/* Caliper Measurement Marker */}
      <circle cx="12" cy="12.5" r="1.25" fill="#22D3EE" />
    </svg>
  );
}

/**
 * Bespoke 1.25px stroke duotone Research / Collaborative Sync Icon
 */
export function DuotoneResearchIcon({ className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <circle cx="6" cy="7" r="2.5" fill="#22D3EE" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="18" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="12" cy="17" r="3" fill="#F59E0B" fillOpacity="0.2" stroke="#F59E0B" strokeWidth="1.25" />
      {/* Synapse Lines */}
      <path d="M8.2 8.5L10.5 14.5M15.8 8.5L13.5 14.5M8.5 7H15.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeDasharray="1.5 1.5" />
    </svg>
  );
}
