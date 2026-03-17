'use client';
import { cn } from '@/lib/utils';
import { Children, cloneElement, isValidElement, useRef } from 'react';

type InfiniteSliderProps = {
  children: React.ReactNode;
  gap?: number;
  duration?: number;
  durationOnHover?: number;
  direction?: 'horizontal' | 'vertical';
  reverse?: boolean;
  className?: string;
};

export function InfiniteSlider({
  children,
  gap = 16,
  duration = 25,
  durationOnHover,
  direction = 'horizontal',
  reverse = false,
  className,
}: InfiniteSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const childArray = Children.toArray(children);

  const handleMouseEnter = () => {
    if (durationOnHover && containerRef.current) {
      containerRef.current.style.animationDuration = `${durationOnHover}s`;
    }
  };

  const handleMouseLeave = () => {
    if (durationOnHover && containerRef.current) {
      containerRef.current.style.animationDuration = `${duration}s`;
    }
  };

  const renderItems = (keyPrefix: string) =>
    childArray.map((child, i) =>
      isValidElement(child)
        ? cloneElement(child, { key: `${keyPrefix}-${i}` })
        : child
    );

  const isHorizontal = direction === 'horizontal';
  const animationName = isHorizontal
    ? reverse ? 'infinite-slider-reverse-x' : 'infinite-slider-x'
    : reverse ? 'infinite-slider-reverse-y' : 'infinite-slider-y';

  return (
    <div className={cn('overflow-hidden', className)}>
      <style jsx>{`
        @keyframes infinite-slider-x {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes infinite-slider-reverse-x {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        @keyframes infinite-slider-y {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
        @keyframes infinite-slider-reverse-y {
          from { transform: translateY(-50%); }
          to { transform: translateY(0); }
        }
      `}</style>
      <div
        ref={containerRef}
        className="flex w-max"
        style={{
          gap: `${gap}px`,
          flexDirection: isHorizontal ? 'row' : 'column',
          animation: `${animationName} ${duration}s linear infinite`,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Two identical copies for seamless loop */}
        {renderItems('a')}
        {renderItems('b')}
      </div>
    </div>
  );
}
