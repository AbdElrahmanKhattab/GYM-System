import { useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export default function BeforeAfterSlider({ card }) {
  const { t } = useLanguage();
  const sliderRef = useRef(null);
  const isDraggingRef = useRef(false);

  const setSliderPos = (clientX) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    let pos = ((clientX - rect.left) / rect.width) * 100;
    pos = Math.max(0, Math.min(100, pos));
    
    sliderRef.current.style.setProperty('--pos', `${pos}%`);
    sliderRef.current.setAttribute('aria-valuenow', Math.round(pos));
  };

  const handleStartDrag = (e) => {
    isDraggingRef.current = true;
    sliderRef.current.classList.add('dragging');
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setSliderPos(clientX);
    
    // Hide custom cursor rings during dragging
    document.body.classList.add('ba-active');
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDraggingRef.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setSliderPos(clientX);
    };

    const handleEndDrag = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        if (sliderRef.current) {
          sliderRef.current.classList.remove('dragging');
        }
        document.body.classList.remove('ba-active');
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEndDrag);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEndDrag);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEndDrag);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEndDrag);
    };
  }, []);

  const handleKeyDown = (e) => {
    if (!sliderRef.current) return;
    const currentStyle = sliderRef.current.style.getPropertyValue('--pos') || '50%';
    const current = parseFloat(currentStyle);
    let nextVal = current;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nextVal = Math.max(0, current - 5);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nextVal = Math.min(100, current + 5);
    else if (e.key === 'Home') nextVal = 0;
    else if (e.key === 'End') nextVal = 100;
    else return;

    e.preventDefault();
    sliderRef.current.style.setProperty('--pos', `${nextVal}%`);
    sliderRef.current.setAttribute('aria-valuenow', Math.round(nextVal));
  };

  // Run the subtle reveal slide animation when mounted
  useEffect(() => {
    if (!sliderRef.current) return;
    
    // Animate divider left and right once to grab attention
    const t1 = setTimeout(() => {
      if (sliderRef.current) sliderRef.current.style.setProperty('--pos', '35%');
    }, 400);
    const t2 = setTimeout(() => {
      if (sliderRef.current) sliderRef.current.style.setProperty('--pos', '65%');
    }, 1200);
    const t3 = setTimeout(() => {
      if (sliderRef.current) sliderRef.current.style.setProperty('--pos', '50%');
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className={`t-card ${card.gridClass} reveal`}>
      <div 
        ref={sliderRef}
        className="ba-slider" 
        role="slider"
        aria-label={`${card.name}'s transformation`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={50}
        tabIndex="0"
        onMouseDown={handleStartDrag}
        onTouchStart={handleStartDrag}
        onKeyDown={handleKeyDown}
        style={{ '--pos': '50%' }}
      >
        <img className="ba-img ba-after" src={card.afterImg} alt={`${card.name} after`} />
        <div className="ba-clip">
          <img className="ba-img ba-before" src={card.beforeImg} alt={`${card.name} before`} />
        </div>
        <div className="ba-overlay" />
        <div className="ba-divider">
          <div className="ba-handle">
            <span>‹</span><span>›</span>
          </div>
        </div>
      </div>
      <div className="t-tag">
        <span className="badge badge-before">{t('gallery.before')}</span>
        <span className="badge badge-after">{t('gallery.after')}</span>
      </div>
      <div className="t-info">
        <div>
          <div className="name">{t(`gallery.cards.${card.id}.name`)}</div>
          <div className="meta">
            <span>{t(`gallery.cards.${card.id}.time`)}</span>
            <span className="sep" />
            <span>{t(`gallery.cards.${card.id}.program`)}</span>
          </div>
        </div>
        <div className="result">{t(`gallery.cards.${card.id}.result`)}</div>
      </div>
    </div>
  );
}
