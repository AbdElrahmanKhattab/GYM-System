import { useState, useEffect, useRef } from 'react';
import './index.css';
import BeforeAfterSlider from './components/BeforeAfterSlider';
import { useLanguage } from './contexts/LanguageContext';

const TRANSFORMATION_CARDS = [
  {
    id: 1,
    name: 'Marcus Thompson',
    time: '16 Weeks',
    program: 'Strength Program',
    result: '−24 kg',
    beforeImg: 'https://images.unsplash.com/photo-1583454340496-0489f7c9b30b?q=80&w=1200',
    afterImg: 'https://images.unsplash.com/photo-1583454112855-76f796ae5c4d?q=80&w=1200',
    gridClass: 't-card-1'
  },
  {
    id: 2,
    name: 'Elena Rodriguez',
    time: '24 Weeks',
    program: 'Competition Prep',
    result: 'Pro Card',
    beforeImg: 'https://images.unsplash.com/photo-1521804906057-1df8fdb718b7?q=80&w=1000',
    afterImg: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?q=80&w=1000',
    gridClass: 't-card-2'
  },
  {
    id: 3,
    name: 'David Kim',
    time: '12 Weeks',
    program: 'Hypertrophy',
    result: '+8 kg',
    beforeImg: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=800',
    afterImg: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=800',
    gridClass: 't-card-3'
  },
  {
    id: 4,
    name: 'Sara Mendez',
    time: '20 Weeks',
    program: 'Postnatal',
    result: '−15 kg',
    beforeImg: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?q=80&w=800',
    afterImg: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=800',
    gridClass: 't-card-4'
  },
  {
    id: 5,
    name: 'James Lockhart',
    time: '32 Weeks',
    program: 'Powerlifting',
    result: '+180kg DL',
    beforeImg: 'https://images.unsplash.com/photo-1532384748853-8f54a8f476e2?q=80&w=800',
    afterImg: 'https://images.unsplash.com/photo-1623874514711-0f321325f318?q=80&w=800',
    gridClass: 't-card-5'
  }
];

export default function App() {
  const { t, locale, toggleLanguage } = useLanguage();
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [settings, setSettings] = useState(null);
  
  // Custom Cursor coordinates
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [ringPos, setRingPos] = useState({ x: 0, y: 0 });
  const [cursorHover, setCursorHover] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);

  // Mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Scroll tracking for Navbar & Scroll progress
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Counters
  const [activeMembersCount, setActiveMembersCount] = useState(0);
  const [trainersCount, setTrainersCount] = useState(0);
  const [equipmentCount, setEquipmentCount] = useState(0);

  // Form State
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    age: '',
    gender: 'male',
    fitnessGoal: '',
    heightCm: '',
    weightKg: '',
    preferredSubscriptionId: '',
    notes: ''
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState(null);

  // Refs for Scroll reveal triggers & Counters
  const statsRef = useRef(null);

  // Track Mouse movement for custom cursor
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Soft lagging animation for the outer cursor ring
  useEffect(() => {
    let animationFrameId;
    const updateRing = () => {
      setRingPos(prev => {
        const dx = mousePos.x - prev.x;
        const dy = mousePos.y - prev.y;
        return {
          x: prev.x + dx * 0.18,
          y: prev.y + dy * 0.18
        };
      });
      animationFrameId = requestAnimationFrame(updateRing);
    };
    animationFrameId = requestAnimationFrame(updateRing);
    return () => cancelAnimationFrame(animationFrameId);
  }, [mousePos]);

  // Navbar scroll check & scroll progress bar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalScroll > 0 ? (window.scrollY / totalScroll) * 100 : 0;
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Set up mouse hover scale listeners for custom cursor on all interactive elements
  useEffect(() => {
    const handleMouseEnter = () => setCursorHover(true);
    const handleMouseLeave = () => setCursorHover(false);

    const selectElements = () => {
      const elList = document.querySelectorAll('a, button, select, input, textarea, [data-hover], .ba-slider');
      elList.forEach(el => {
        el.addEventListener('mouseenter', handleMouseEnter);
        el.addEventListener('mouseleave', handleMouseLeave);
      });
      return elList;
    };

    // Wait a brief moment for DOM render/API loads
    const timer = setTimeout(() => {
      const elements = selectElements();
      return () => {
        elements.forEach(el => {
          el.removeEventListener('mouseenter', handleMouseEnter);
          el.removeEventListener('mouseleave', handleMouseLeave);
        });
      };
    }, 500);

    return () => clearTimeout(timer);
  }, [loadingPlans]);
  // Fetch subscriptions and settings from public API
  useEffect(() => {
    async function fetchData() {
      try {
        const [plansRes, settingsRes] = await Promise.all([
          fetch('/api/public/subscriptions'),
          fetch('/api/public/settings')
        ]);
        
        if (plansRes.ok) {
          const plansData = await plansRes.json();
          setPlans(plansData.subscriptions || []);
        }
        
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings(settingsData.settings);
          if (settingsData.settings.theme === 'light') {
            document.body.setAttribute('data-theme', 'light');
          } else {
            document.body.removeAttribute('data-theme');
          }
        }
      } catch (err) {
        console.error('Failed to load data', err);
      } finally {
        setLoadingPlans(false);
      }
    }
    fetchData();
  }, []);

  // IntersectionObserver for elements with the .reveal class
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    reveals.forEach((r) => observer.observe(r));
    return () => observer.disconnect();
  }, [loadingPlans]);

  // IntersectionObserver for Stat Counters
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Animate counters
          animateCounter(12000, setActiveMembersCount);
          animateCounter(45, setTrainersCount);
          animateCounter(50, setEquipmentCount);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const animateCounter = (target, setter) => {
    const duration = 2200;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Cubic Ease Out
      setter(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
      else setter(target);
    };
    requestAnimationFrame(animate);
  };



  // Select subscription plan and auto-scroll to register form
  const selectPlan = (planId) => {
    setForm(prev => ({ ...prev, preferredSubscriptionId: planId }));
    const registerSection = document.getElementById('contact');
    if (registerSection) {
      const offset = 80;
      const top = registerSection.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const handleInputChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // Registration inquiry submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormSuccess(false);
    setFormError(null);
    try {
      const res = await fetch('/api/public/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Submission failed. Please verify form details.');
      }
      setFormSuccess(true);
      setForm({
        fullName: '',
        phone: '',
        age: '',
        gender: 'male',
        fitnessGoal: '',
        heightCm: '',
        weightKg: '',
        preferredSubscriptionId: '',
        notes: ''
      });
      // Clear success notification after 5s
      setTimeout(() => setFormSuccess(false), 5000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div onMouseEnter={() => setCursorHidden(false)} onMouseLeave={() => setCursorHidden(true)}>
      
      {/* Custom Mouse Cursor */}
      <div 
        className="cursor-dot" 
        style={{ 
          left: `${mousePos.x}px`, 
          top: `${mousePos.y}px`, 
          opacity: cursorHidden ? 0 : 1 
        }} 
      />
      <div 
        className={`cursor-ring ${cursorHover ? 'hover' : ''}`} 
        style={{ 
          left: `${ringPos.x}px`, 
          top: `${ringPos.y}px`, 
          opacity: cursorHidden ? 0 : 1 
        }} 
      />

      {/* Progress bar */}
      <div className="scroll-progress" style={{ width: `${scrollProgress}%` }} />

      {/* Navigation */}
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-inner">
          <a href="#" className="logo" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>
            <div className="logo-mark">{settings?.gymName ? settings.gymName.charAt(0) : 'H'}</div>
            <span>{settings?.gymName || 'HERO GYM'}</span>
          </a>
          <ul className="nav-links">
            <li><a href="#home" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{t('nav.home')}</a></li>
            <li><a href="#about" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{t('nav.about')}</a></li>
            <li><a href="#gallery" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{t('nav.gallery')}</a></li>
            <li><a href="#membership" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{t('nav.memberships')}</a></li>
            <li><a href="#contact" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{t('nav.register')}</a></li>
          </ul>
          <div className="nav-cta">
            <button 
              className="lang-toggle-btn"
              onClick={toggleLanguage}
              onMouseEnter={() => setCursorHover(true)}
              onMouseLeave={() => setCursorHover(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: 16, height: 16, verticalAlign: 'middle'}}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span className="lang-text" style={{ marginLeft: locale === 'ar' ? 0 : '6px', marginRight: locale === 'ar' ? '6px' : 0 }}>{locale === 'en' ? 'العربية' : 'English'}</span>
            </button>
            <a 
              href="#membership" 
              className="btn btn-primary btn-nav-join" 
              onMouseEnter={() => setCursorHover(true)} 
              onMouseLeave={() => setCursorHover(false)}
            >
              {t('nav.joinNow')}
              <span className="arrow">{locale === 'ar' ? '←' : '→'}</span>
            </a>
            <button 
              className="menu-toggle" 
              onClick={() => setMobileMenuOpen(true)}
              onMouseEnter={() => setCursorHover(true)} 
              onMouseLeave={() => setCursorHover(false)}
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="mobile-close" onClick={() => setMobileMenuOpen(false)}>✕</button>
        <button 
          className="mobile-lang-toggle btn" 
          onClick={() => { toggleLanguage(); setMobileMenuOpen(false); }}
          style={{ alignSelf: 'center', marginBottom: '1.5rem', border: '1px solid var(--border-strong)', padding: '8px 16px', fontSize: '12px' }}
        >
          {locale === 'en' ? 'العربية' : 'English'}
        </button>
        <a href="#home" onClick={() => setMobileMenuOpen(false)}>{t('nav.home')}</a>
        <a href="#about" onClick={() => setMobileMenuOpen(false)}>{t('nav.about')}</a>
        <a href="#gallery" onClick={() => setMobileMenuOpen(false)}>{t('nav.gallery')}</a>
        <a href="#membership" onClick={() => setMobileMenuOpen(false)}>{t('nav.memberships')}</a>
        <a href="#contact" onClick={() => setMobileMenuOpen(false)}>{t('nav.register')}</a>
      </div>

      {/* Hero Section */}
      <section className="hero" id="home">
        <div className="hero-bg" />
        
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="line" />
            <span className="eyebrow-gold">{t('hero.eyebrow')}</span>
          </div>
          <h1 className="hero-title display">
            {t('hero.title1')}<br />
            {t('hero.title2')}<br />
            <span className="gold-word">{t('hero.title3')}</span>
          </h1>
          <p className="hero-sub">
            {t('hero.sub')}
          </p>
          <div className="hero-actions">
            <a 
              href="#membership" 
              className="btn btn-primary"
              onMouseEnter={() => setCursorHover(true)} 
              onMouseLeave={() => setCursorHover(false)}
            >
              {t('hero.joinNow')}
              <span className="arrow">{locale === 'ar' ? '←' : '→'}</span>
            </a>
            <a 
              href="#gallery" 
              className="btn btn-ghost"
              onMouseEnter={() => setCursorHover(true)} 
              onMouseLeave={() => setCursorHover(false)}
            >
              {t('hero.watchVideo')}
            </a>
          </div>
        </div>

        <div className="hero-bottom-stats" ref={statsRef}>
          <div className="stat-item">
            <div className="num">
              <span>{activeMembersCount.toLocaleString()}</span>
              <span className="suffix">+</span>
            </div>
            <div className="label">{t('hero.stats.members')}</div>
          </div>
          <div className="stat-item">
            <div className="num">
              <span>{trainersCount}</span>
              <span className="suffix">+</span>
            </div>
            <div className="label">{t('hero.stats.trainers')}</div>
          </div>
          <div className="stat-item">
            <div className="num">
              <span>{equipmentCount}</span>
              <span className="suffix">+</span>
            </div>
            <div className="label">{t('hero.stats.equipment')}</div>
          </div>
        </div>

        <div className="hero-badge">
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <defs>
              <path id="circlePath" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
            </defs>
            <text fontFamily="Cairo" fontSize="9.5" fontWeight="600" letterSpacing="1.2" fill="#f6f6f6">
              <textPath href="#circlePath">{t('hero.badgeText')}</textPath>
            </text>
          </svg>
          <div 
            className="badge-center"
            onMouseEnter={() => setCursorHover(true)} 
            onMouseLeave={() => setCursorHover(false)}
            onClick={() => document.getElementById('membership').scrollIntoView({ behavior: 'smooth' })}
          >
            {locale === 'ar' ? '←' : '→'}
          </div>
        </div>
      </section>

      {/* Marquee Info line */}
      <div className="marquee">
        <div className="marquee-track">
          <span className="marquee-item">{t('marquee.strength')}<span className="dot" /></span>
          <span className="marquee-item outline">{t('marquee.discipline')}<span className="dot" /></span>
          <span className="marquee-item">{t('marquee.power')}<span className="dot" /></span>
          <span className="marquee-item outline">{t('marquee.endurance')}<span className="dot" /></span>
          <span className="marquee-item">{t('marquee.excellence')}<span className="dot" /></span>
          <span className="marquee-item outline">{t('marquee.legacy')}<span className="dot" /></span>
          <span className="marquee-item">{t('marquee.strength')}<span className="dot" /></span>
          <span className="marquee-item outline">{t('marquee.discipline')}<span className="dot" /></span>
          <span className="marquee-item">{t('marquee.power')}<span className="dot" /></span>
          <span className="marquee-item outline">{t('marquee.endurance')}<span className="dot" /></span>
          <span className="marquee-item">{t('marquee.excellence')}<span className="dot" /></span>
          <span className="marquee-item outline">{t('marquee.legacy')}<span className="dot" /></span>
        </div>
      </div>

      {/* About */}
      <section className="about" id="about">
        <div className="about-deco">{t('about.deco')}</div>
        <div className="container">
          <div className="about-grid">
            <div className="about-visual reveal">
              <div className="about-img-1" />
              <div className="about-img-2" />
            </div>
            <div className="about-content">
              <div className="number">{t('about.number')}</div>
              <h2 className="reveal">
                {t('about.title1')}<br />
                {locale === 'ar' ? (
                  <>
                    <span className="italic">{t('about.refuse')}</span> {t('about.title2')}
                  </>
                ) : (
                  <>
                    who <span className="italic">{t('about.refuse')}</span> to settle.
                  </>
                )}
              </h2>
              <p className="reveal reveal-delay-1" style={{ whiteSpace: 'pre-wrap' }}>
                {settings?.landingPageContent?.about && typeof settings.landingPageContent.about === 'object' ? (
                  <>
                    {settings.landingPageContent.about.title && (
                      <span style={{ display: 'block', color: 'var(--gold)', fontWeight: 'bold', marginBottom: '1rem' }}>
                        {settings.landingPageContent.about.title}
                      </span>
                    )}
                    {Array.isArray(settings.landingPageContent.about.items) && 
                      settings.landingPageContent.about.items.map((item, idx) => (
                        <span key={idx} style={{ display: 'block', marginBottom: '0.5rem' }}>
                          ✓ {item}
                        </span>
                      ))
                    }
                  </>
                ) : (
                  locale === 'ar' ? (
                    "تأسس هيروجيم في عام ٢٠١٤ بناءً على شغف بسيط ومطلق — وهو أن اللياقة البدنية يجب أن تبدو كعمل فني متقن، وليست مجرد استهلاك يومي. كل تفصيل، بدءاً من معايرة أجهزتنا وحتى كفاءة وخبرة مدربينا، تم تحسينها وتطويرها على مدار عقد من الزمان.\n\nنحن لا نبيع عضويات، بل نصنع التحولات الجسدية والذهنية. أعضاؤنا لا يتمرنون فقط، بل نوجههم ونقيس تطورهم وندفعهم لتجاوز حدود قدراتهم."
                  ) : (
                    settings?.landingPageContent?.about || "Founded in 2014, HERO GYM was born from a simple obsession — that fitness should feel like craftsmanship, not consumption. Every detail, from the calibrations of our equipment to the credentials of our coaches, has been refined over a decade.\n\nWe don't sell memberships. We architect transformations. Our members don't just work out — they are mentored, measured, and pushed past what they thought possible."
                  )
                )}
              </p>
              <div className="signature reveal reveal-delay-3">
                <div>
                  <div className="sig-name">{t('about.signatureName')}</div>
                  <div className="sig-role">{t('about.signatureRole')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Hero (Features) */}
      <section className="features">
        <div className="container">
          <div className="section-head">
            <div className="left">
              <div className="number reveal">{t('features.number')}</div>
              <h2 className="reveal reveal-delay-1">
                {locale === 'ar' ? (
                  <>تجربة <span className="italic">مصممة</span> للنتائج.</>
                ) : (
                  <>An experience <span className="italic">engineered</span> for results.</>
                )}
              </h2>
            </div>
            <div className="right reveal reveal-delay-2">
              <p>{t('features.sub')}</p>
            </div>
          </div>
          <div className="features-grid">
            <div className="feature-card reveal">
              <span className="num">01</span>
              <div className="icon">★</div>
              <h3>{t('features.card1.title')}</h3>
              <p>{t('features.card1.desc')}</p>
            </div>
            <div className="feature-card reveal reveal-delay-1">
              <span className="num">02</span>
              <div className="icon">◈</div>
              <h3>{t('features.card2.title')}</h3>
              <p>{t('features.card2.desc')}</p>
            </div>
            <div className="feature-card reveal reveal-delay-2">
              <span className="num">03</span>
              <div className="icon">📈</div>
              <h3>{t('features.card3.title')}</h3>
              <p>{t('features.card3.desc')}</p>
            </div>
            <div className="feature-card reveal reveal-delay-3">
              <span className="num">04</span>
              <div className="icon">🏢</div>
              <h3>{t('features.card4.title')}</h3>
              <p>{t('features.card4.desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Before / After Transformations Gallery */}
      <section className="transform" id="gallery">
        <div className="container">
          <div className="section-head">
            <div className="left">
              <div className="number reveal">{t('gallery.number')}</div>
              <h2 className="reveal reveal-delay-1">
                {t('gallery.title1')}<br />
                <span className="italic">{t('gallery.title2')}</span>
              </h2>
            </div>
            <div className="right reveal reveal-delay-2">
              <p>{t('gallery.sub')}</p>
            </div>
          </div>

          <div className="transform-grid">
            {TRANSFORMATION_CARDS.map((card) => (
              <BeforeAfterSlider key={card.id} card={card} />
            ))}
          </div>
        </div>
      </section>

      {/* Subscription Plans Section */}
      <section className="membership" id="membership">
        <div className="container">
          <div className="section-head">
            <div className="left">
              <div className="number reveal">{t('membership.number')}</div>
              <h2 className="reveal reveal-delay-1">
                {t('membership.title')}<br />
                <span className="italic">{t('membership.italic')}</span>
              </h2>
            </div>
            <div className="right reveal reveal-delay-2">
              <p>{t('membership.sub')}</p>
            </div>
          </div>

          <div className="plans">
            {loadingPlans ? (
              <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <div className="loading-spinner" />
              </div>
            ) : plans.length === 0 ? (
              <p style={{ gridColumn: 'span 3', textAlign: 'center', color: 'var(--text-muted)' }}>{t('membership.noPlans')}</p>
            ) : (
              plans.map((plan, idx) => {
                // Localized duration type
                const durationKey = plan.durationType?.toLowerCase();
                const singleDurationType = durationKey ? (durationKey.endsWith('s') ? durationKey.slice(0, -1) : durationKey) : '';
                const localizedDurationType = plan.durationValue === 1 
                  ? t(`membership.durationType.${singleDurationType}`) 
                  : t(`membership.durationType.${durationKey}`);

                return (
                  <div 
                    key={plan.id} 
                    className={`plan reveal ${idx === 1 ? 'featured' : ''}`}
                    onMouseEnter={() => setCursorHover(true)} 
                    onMouseLeave={() => setCursorHover(false)}
                  >
                    <div className="plan-name">{plan.name}</div>
                    <div className="plan-title">{plan.name} {t('membership.package')}</div>
                    <p className="plan-desc">{plan.description || t('membership.descPlaceholder')}</p>
                    
                    <div className="price">
                      <span className="currency">$</span>
                      <span className="amount">{Number(plan.price).toFixed(0)}</span>
                      <span className="period">
                        {t('membership.period', { value: plan.durationValue, type: localizedDurationType })}
                      </span>
                    </div>
                    
                    <ul className="plan-features">
                      <li>✓ {t('membership.feature1')}</li>
                      <li>✓ {t('membership.feature2')}</li>
                      <li>✓ {t('membership.feature3')}</li>
                      {plan.freezeAllowed ? (
                        <li>✓ {t('membership.feature4Allowed')}</li>
                      ) : (
                        <li className="disabled">✗ {t('membership.feature4NotAllowed')}</li>
                      )}
                    </ul>
                    
                    <button 
                      onClick={() => selectPlan(plan.id)}
                      className={`btn ${idx === 1 ? 'btn-primary' : 'btn-ghost'}`}
                    >
                      {t('membership.selectPlan')}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Registration Section */}
      <section className="contact" id="contact">
        <div className="container">
          <div className="section-head">
            <div className="left">
              <div className="number reveal">{t('contact.number')}</div>
              <h2 className="reveal reveal-delay-1">
                {t('contact.title')}<br />
                <span className="italic">{t('contact.italic')}</span>
              </h2>
            </div>
            <div className="right reveal reveal-delay-2">
              <p>{t('contact.sub')}</p>
            </div>
          </div>

          <div className="contact-grid">
            <form className="contact-form reveal" onSubmit={handleFormSubmit}>
              <div className="form-title">{t('contact.formTitle')}</div>
              <p className="form-sub" style={{ marginBottom: '2rem' }}>{t('contact.formSub')}</p>

              {formSuccess && (
                <div style={{ 
                  background: 'rgba(212, 175, 55, 0.1)', 
                  border: '1px solid var(--gold)', 
                  color: 'var(--gold)', 
                  padding: '1rem', 
                  borderRadius: '12px', 
                  marginBottom: '1.5rem', 
                  fontWeight: 600,
                  fontSize: '0.9rem' 
                }}>
                  {t('contact.successMsg')}
                </div>
              )}
              {formError && (
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid #ef4444', 
                  color: '#ef4444', 
                  padding: '1rem', 
                  borderRadius: '12px', 
                  marginBottom: '1.5rem', 
                  fontWeight: 600,
                  fontSize: '0.9rem' 
                }}>
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label>{t('contact.labelName')}</label>
                <input 
                  type="text" 
                  placeholder={t('contact.placeholderName')} 
                  value={form.fullName}
                  onChange={e => handleInputChange('fullName', e.target.value)}
                  required 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('contact.labelPhone')}</label>
                  <input 
                    type="tel" 
                    placeholder={t('contact.placeholderPhone')} 
                    value={form.phone}
                    onChange={e => handleInputChange('phone', e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>{t('contact.labelAge')}</label>
                  <input 
                    type="number" 
                    placeholder={t('contact.placeholderAge')} 
                    value={form.age}
                    onChange={e => handleInputChange('age', e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('contact.labelGender')}</label>
                  <select 
                    value={form.gender}
                    onChange={e => handleInputChange('gender', e.target.value)}
                  >
                    <option value="male">{t('contact.genderMale')}</option>
                    <option value="female">{t('contact.genderFemale')}</option>
                    <option value="other">{t('contact.genderOther')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('contact.labelPlan')}</label>
                  <select 
                    value={form.preferredSubscriptionId}
                    onChange={e => handleInputChange('preferredSubscriptionId', e.target.value)}
                  >
                    <option value="">{t('contact.choosePlan')}</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('contact.labelHeight')}</label>
                  <input 
                    type="number" 
                    placeholder={t('contact.placeholderHeight')} 
                    value={form.heightCm}
                    onChange={e => handleInputChange('heightCm', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>{t('contact.labelWeight')}</label>
                  <input 
                    type="number" 
                    placeholder={t('contact.placeholderWeight')} 
                    value={form.weightKg}
                    onChange={e => handleInputChange('weightKg', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t('contact.labelGoal')}</label>
                <input 
                  type="text" 
                  placeholder={t('contact.placeholderGoal')} 
                  value={form.fitnessGoal}
                  onChange={e => handleInputChange('fitnessGoal', e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label>{t('contact.labelNotes')}</label>
                <textarea 
                  placeholder={t('contact.placeholderNotes')} 
                  value={form.notes}
                  onChange={e => handleInputChange('notes', e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={formSubmitting}
                onMouseEnter={() => setCursorHover(true)} 
                onMouseLeave={() => setCursorHover(false)}
              >
                {formSubmitting ? t('contact.submitting') : t('contact.submitBtn')}
                <span className="arrow">{locale === 'ar' ? '←' : '→'}</span>
              </button>
            </form>

            <div className="contact-info">
              <div className="info-card reveal" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>
                <div className="icon">☎</div>
                <div>
                  <div className="label">{t('contact.info.callUs')}</div>
                  <div className="value">{settings?.phoneNumbers?.[0] || '+1 (555) 842-HERO'}</div>
                </div>
              </div>
              <div className="info-card reveal reveal-delay-1" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>
                <div className="icon">📍</div>
                <div>
                  <div className="label">{t('contact.info.visitUs')}</div>
                  <div className="value">{settings?.address || '842 Athletic Ave, New York, NY 10013'}</div>
                </div>
              </div>
              <div className="info-card reveal reveal-delay-2" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>
                <div className="icon">✉</div>
                <div>
                  <div className="label">{t('contact.info.emailUs')}</div>
                  <div className="value">{settings?.socialLinks?.email || 'hello@herogym.club'}</div>
                </div>
              </div>
              <div className="info-card reveal reveal-delay-3" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>
                <div className="icon">⏰</div>
                <div>
                  <div className="label">{t('contact.info.workingHours')}</div>
                  <div className="value">{t('contact.info.hoursVal')}</div>
                </div>
              </div>
              <div className="map-card reveal reveal-delay-4">
                <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=-74.01,40.72,-74.00,40.73&layer=mapnik" loading="lazy" title="Map of gym location" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gilded CTA */}
      <section className="cta-section">
        <div className="cta-bg" />
        <div className="cta-content">
          <div className="cta-eyebrow reveal">
            <span className="dot" />
            <span>{t('cta.eyebrow')}</span>
          </div>
          <h2 className="cta-title reveal reveal-delay-1">
            {locale === 'ar' ? (
              <>توقف عن الانتظار.<br />ابدأ <span className="italic">البناء.</span></>
            ) : (
              <>Stop waiting.<br />Start <span className="italic">forging.</span></>
            )}
          </h2>
          <p className="cta-sub reveal reveal-delay-2">
            {t('cta.sub')}
          </p>
          <div className="cta-actions reveal reveal-delay-3">
            <a 
              href="#contact" 
              className="btn btn-primary"
              onMouseEnter={() => setCursorHover(true)} 
              onMouseLeave={() => setCursorHover(false)}
            >
              {t('cta.btn')}
              <span className="arrow">{locale === 'ar' ? '←' : '→'}</span>
            </a>
            <a 
              href="tel:+15558424376" 
              className="btn btn-ghost"
              onMouseEnter={() => setCursorHover(true)} 
              onMouseLeave={() => setCursorHover(false)}
            >
              {settings?.phoneNumbers?.[0] || '+1 (555) 842-HERO'}
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="#" className="logo">
                <div className="logo-mark">H</div>
                <span>HERO<span style={{ color: 'var(--gold)' }}>.</span>GYM</span>
              </a>
              <p>{t('footer.brandDesc')}</p>
            </div>
            <div className="footer-col">
              <h4>{t('footer.explore')}</h4>
              <ul>
                <li><a href="#home" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{t('nav.home')}</a></li>
                <li><a href="#about" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{t('nav.about')}</a></li>
                <li><a href="#gallery" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{t('nav.gallery')}</a></li>
                <li><a href="#membership" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{t('nav.memberships')}</a></li>
                <li><a href="#contact" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{t('nav.register')}</a></li>
              </ul>
            </div>
            
            <div className="footer-col">
              <h4>{t('footer.contact')}</h4>
              <ul>
                <li><a href="tel:+15558424376" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{settings?.phoneNumbers?.[0] || '+1 (555) 842-HERO'}</a></li>
                <li><a href="mailto:hello@herogym.club" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>{settings?.socialLinks?.email || 'hello@herogym.club'}</a></li>
                <li><span style={{ color: 'var(--text-muted)' }}>{settings?.address || '842 Athletic Ave, NY'}</span></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>{t('footer.rights', { year: new Date().getFullYear() })}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
