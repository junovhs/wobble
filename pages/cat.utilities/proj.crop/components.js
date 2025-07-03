const { useState, useEffect, useRef, useCallback } = React;

const HelpText = ({ children, style }) => (
  <div className="help-text" style={style}>
    {children}
  </div>
);

const IntroText = ({ show }) => {
  if (!show) return null;
  return (
    <div className="intro-text">
      Drop images to start cropping
    </div>
  );
};

const SliderWithDots = ({ min, max, step, value, onChange, onDoubleClick }) => (
  <div className="slider-with-dots">
    <input 
      type="range" 
      className="slider"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      onDoubleClick={onDoubleClick}
    />
  </div>
);

const RotationHandle = ({ rotation, onRotationChange, containerRef, onReset }) => {
  return null;
};

const Crosshair = ({ show }) => {
  if (!show) return null;
  return (
    <div className="crosshair">
      <div className="crosshair-line crosshair-h"></div>
      <div className="crosshair-line crosshair-v"></div>
    </div>
  );
};