import React from 'react';
import { Ico, I } from './Icons';

import { useT } from '../../hooks/useTranslation';

interface KnobProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  onReset: () => void;
}

export function Knob({ label, value, unit, min, max, step, format, onChange, onReset }: KnobProps) {
  const { t } = useT();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="knob">
      <div className="knob-h">
        <span className="knob-l">{label}</span>
        <button className="knob-reset" onClick={onReset} title={t('reset_btn')}>
          <Ico d={I.reset} size={10} />
        </button>
      </div>
      <div className="knob-v mono">
        {format(value)}
        <small>{unit}</small>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ ['--p' as string]: pct + '%' } as React.CSSProperties}
        className="knob-slider"
      />
    </div>
  );
}
