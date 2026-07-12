"use client";

import { useEffect, useState } from "react";
import { useApp } from "./Providers";

export default function LoadingScreen() {
  const { isLoading } = useApp();
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const steps = [[22,180],[41,430],[63,760],[79,1120],[91,1550]] as const;
    const timers = steps.map(([value,delay]) => setTimeout(() => setProgress(value), delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      const fade = setTimeout(() => setLeaving(true), 280);
      const hide = setTimeout(() => setShow(false), 900);
      return () => { clearTimeout(fade); clearTimeout(hide); };
    }
  }, [isLoading]);

  if (!show) return null;

  return (
    <div className={"whistly-loader "+(leaving?"whistly-loader-leaving":"")}>
      <div className="whistly-loader-grid"/>
      <div className="whistly-loader-glow whistly-loader-glow-one"/>
      <div className="whistly-loader-glow whistly-loader-glow-two"/>
      <div className="whistly-loader-content">
        <div className="whistly-loader-mark">
          <span className="whistly-loader-orbit orbit-one"/>
          <span className="whistly-loader-orbit orbit-two"/>
          <span className="whistly-loader-w">W</span>
          <div className="whistly-signal" aria-hidden="true">{[1,2,3,4,5].map(bar=><span key={bar}/>)}</div>
        </div>
        <div className="whistly-loader-copy">
          <h1>WHIST<span>LY</span></h1>
          <p>Listen to the market</p>
        </div>
        <div className="whistly-progress">
          <div className="whistly-progress-meta"><span>Loading live markets</span><strong>{progress}%</strong></div>
          <div className="whistly-progress-track"><div className="whistly-progress-fill" style={{width:progress+"%"}}/></div>
        </div>
        <div className="whistly-loader-status"><span/> Syncing verified outcomes</div>
      </div>
    </div>
  );
}