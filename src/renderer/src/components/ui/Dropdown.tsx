import React from 'react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (v: string) => void;
  options: (string | DropdownOption)[];
  width?: number | string;
  align?: 'start' | 'end';
}

export function Dropdown({ value, onChange, options, width, align = 'start' }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const opts: DropdownOption[] = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );
  const cur = opts.find((o) => o.value === value) || opts[0];

  return (
    <div
      className={`dd ${open ? 'open' : ''}`}
      ref={ref}
      style={width ? { width } : undefined}
    >
      <button type="button" className="dd-btn" onClick={() => setOpen(!open)}>
        <span className="dd-cur">{cur?.label}</span>
        <svg
          className="dd-caret"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 4l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className={`dd-menu align-${align}`}>
          {opts.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`dd-opt ${o.value === value ? 'on' : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span>{o.label}</span>
              {o.value === value && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
