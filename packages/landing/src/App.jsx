import { useState, useEffect, useRef } from 'react';
import './index.css';
import BeforeAfterSlider from './components/BeforeAfterSlider';

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
            <li><a href="#home" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>Home</a></li>
            <li><a href="#about" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>About</a></li>
            <li><a href="#gallery" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>Gallery</a></li>
            <li><a href="#membership" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>Memberships</a></li>
            <li><a href="#contact" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>Register</a></li>
          </ul>
          <div className="nav-cta">
            <a 
              href="#membership" 
              className="btn btn-primary" 
              onMouseEnter={() => setCursorHover(true)} 
              onMouseLeave={() => setCursorHover(false)}
            >
              Join Now
              <span className="arrow">→</span>
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
        <a href="#home" onClick={() => setMobileMenuOpen(false)}>Home</a>
        <a href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
        <a href="#gallery" onClick={() => setMobileMenuOpen(false)}>Gallery</a>
        <a href="#membership" onClick={() => setMobileMenuOpen(false)}>Memberships</a>
        <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Register</a>
      </div>

      {/* Hero Section */}
      <section className="hero" id="home">
        <div className="hero-bg" />
        
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="line" />
            <span className="eyebrow-gold">Start Your Transformation Today</span>
          </div>
          <h1 className="hero-title display">
            Forge Your Body.<br />
            Forge Your Mind.<br />
            <span className="gold-word">Become A Hero.</span>
          </h1>
          <p className="hero-sub">
            More than a gym. A sanctuary for those who refuse ordinary. Train with elite coaches, recover in private suites, and become the strongest version of yourself.
          </p>
          <div className="hero-actions">
            <a 
              href="#membership" 
              className="btn btn-primary"
              onMouseEnter={() => setCursorHover(true)} 
              onMouseLeave={() => setCursorHover(false)}
            >
              Join Now
              <span className="arrow">→</span>
            </a>
            <a 
              href="#gallery" 
              className="btn btn-ghost"
              onMouseEnter={() => setCursorHover(true)} 
              onMouseLeave={() => setCursorHover(false)}
            >
              Watch Video
            </a>
          </div>
        </div>

        <div className="hero-bottom-stats" ref={statsRef}>
          <div className="stat-item">
            <div className="num">
              <span>{activeMembersCount.toLocaleString()}</span>
              <span className="suffix">+</span>
            </div>
            <div className="label">Active Members</div>
          </div>
          <div className="stat-item">
            <div className="num">
              <span>{trainersCount}</span>
              <span className="suffix">+</span>
            </div>
            <div className="label">Expert Trainers</div>
          </div>
          <div className="stat-item">
            <div className="num">
              <span>{equipmentCount}</span>
              <span className="suffix">+</span>
            </div>
            <div className="label">Premium Equipment</div>
          </div>
        </div>

        <div className="hero-badge">
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <defs>
              <path id="circlePath" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
            </defs>
            <text fontFamily="Syne" fontSize="10.5" fontWeight="600" letterSpacing="1.8" fill="#f6f6f6">
              <textPath href="#circlePath">START YOUR TRANSFORMATION • TODAY • </textPath>
            </text>
          </svg>
          <div 
            className="badge-center"
            onMouseEnter={() => setCursorHover(true)} 
            onMouseLeave={() => setCursorHover(false)}
            onClick={() => document.getElementById('membership').scrollIntoView({ behavior: 'smooth' })}
          >
            →
          </div>
        </div>
      </section>

      {/* Marquee Info line */}
      <div className="marquee">
        <div className="marquee-track">
          <span className="marquee-item">Strength<span className="dot" /></span>
          <span className="marquee-item outline">Discipline<span className="dot" /></span>
          <span className="marquee-item">Power<span className="dot" /></span>
          <span className="marquee-item outline">Endurance<span className="dot" /></span>
          <span className="marquee-item">Excellence<span className="dot" /></span>
          <span className="marquee-item outline">Legacy<span className="dot" /></span>
          <span className="marquee-item">Strength<span className="dot" /></span>
          <span className="marquee-item outline">Discipline<span className="dot" /></span>
          <span className="marquee-item">Power<span className="dot" /></span>
          <span className="marquee-item outline">Endurance<span className="dot" /></span>
          <span className="marquee-item">Excellence<span className="dot" /></span>
          <span className="marquee-item outline">Legacy<span className="dot" /></span>
        </div>
      </div>

      {/* About */}
      <section className="about" id="about">
        <div className="about-deco">02</div>
        <div className="container">
          <div className="about-grid">
            <div className="about-visual reveal">
              <div className="about-img-1" />
              <div className="about-img-2" />
            </div>
            <div className="about-content">
              <div className="number">02 — About Hero Gym</div>
              <h2 className="reveal">
                Built for those<br />
                who <span className="italic">refuse</span><br />
                to settle.
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
                  settings?.landingPageContent?.about || "Founded in 2014, HERO GYM was born from a simple obsession — that fitness should feel like craftsmanship, not consumption. Every detail, from the calibrations of our equipment to the credentials of our coaches, has been refined over a decade.\n\nWe don't sell memberships. We architect transformations. Our members don't just work out — they are mentored, measured, and pushed past what they thought possible."
                )}
              </p>
              <div className="signature reveal reveal-delay-3">
                <div>
                  <div className="sig-name">Daniel Cross</div>
                  <div className="sig-role">Founder & Head Coach</div>
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
              <div className="number reveal">03 — Why Hero</div>
              <h2 className="reveal reveal-delay-1">An experience<br /><span className="italic">engineered</span> for results.</h2>
            </div>
            <div className="right reveal reveal-delay-2">
              <p>Four pillars that define the HERO standard. Every detail is calibrated for performance, recovery, and sustained transformation.</p>
            </div>
          </div>
          <div className="features-grid">
            <div className="feature-card reveal">
              <span className="num">01</span>
              <div className="icon">★</div>
              <h3>Certified Trainers</h3>
              <p>Every coach holds a minimum NASM-CPT certification with 5+ years of elite-level experience. Hand-picked, continuously evaluated.</p>
            </div>
            <div className="feature-card reveal reveal-delay-1">
              <span className="num">02</span>
              <div className="icon">◈</div>
              <h3>Premium Equipment</h3>
              <p>Curated selection of Technogym, Eleiko, and Hammer Strength. Calibrated weekly. Replaced before wear ever shows.</p>
            </div>
            <div className="feature-card reveal reveal-delay-2">
              <span className="num">03</span>
              <div className="icon">📈</div>
              <h3>Personalized Programs</h3>
              <p>No template programs. Your training is built around your body, your goals, your schedule — and adjusted every 4 weeks.</p>
            </div>
            <div className="feature-card reveal reveal-delay-3">
              <span className="num">04</span>
              <div className="icon">🏢</div>
              <h3>Modern Facilities</h3>
              <p>Recovery suites, infrared sauna, cryotherapy, and private training studios. 24/7 access for members.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Before / After Transformations Gallery */}
      <section className="transform" id="gallery">
        <div className="container">
          <div className="section-head">
            <div className="left">
              <div className="number reveal">04 — Real Transformations</div>
              <h2 className="reveal reveal-delay-1">Before & after.<br /><span className="italic">No filters.</span></h2>
            </div>
            <div className="right reveal reveal-delay-2">
              <p>Real members. Real timelines. Real results. Drag the divider on any card to witness each transformation unfold in real time.</p>
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
              <div className="number reveal">05 — Memberships</div>
              <h2 className="reveal reveal-delay-1">Choose your<br /><span className="italic">commitment.</span></h2>
            </div>
            <div className="right reveal reveal-delay-2">
              <p>Flexible structures. No hidden fees. Cancel anytime. Every membership includes an initial consultation and a customized 12-week blueprint.</p>
            </div>
          </div>

          <div className="plans">
            {loadingPlans ? (
              <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <div className="loading-spinner" />
              </div>
            ) : plans.length === 0 ? (
              <p style={{ gridColumn: 'span 3', textAlign: 'center', color: 'var(--text-muted)' }}>No active subscription plans available at this time.</p>
            ) : (
              plans.map((plan, idx) => (
                <div 
                  key={plan.id} 
                  className={`plan reveal ${idx === 1 ? 'featured' : ''}`}
                  onMouseEnter={() => setCursorHover(true)} 
                  onMouseLeave={() => setCursorHover(false)}
                >
                  <div className="plan-name">{plan.name}</div>
                  <div className="plan-title">{plan.name} Package</div>
                  <p className="plan-desc">{plan.description || 'Access to premium gym equipment, customizable training sessions, and elite wellness recovery suites.'}</p>
                  
                  <div className="price">
                    <span className="currency">$</span>
                    <span className="amount">{Number(plan.price).toFixed(0)}</span>
                    <span className="period">/ {plan.durationValue} {plan.durationType}</span>
                  </div>
                  
                  <ul className="plan-features">
                    <li>✓ Complete club access — 24/7</li>
                    <li>✓ Full locker & towel service</li>
                    <li>✓ Complementary orientation PT assessment</li>
                    {plan.freezeAllowed ? (
                      <li>✓ Plan freeze allowed</li>
                    ) : (
                      <li className="disabled">✗ Plan freeze not allowed</li>
                    )}
                  </ul>
                  
                  <button 
                    onClick={() => selectPlan(plan.id)}
                    className={`btn ${idx === 1 ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    Select Plan
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Registration Section */}
      <section className="contact" id="contact">
        <div className="container">
          <div className="section-head">
            <div className="left">
              <div className="number reveal">06 — Registration</div>
              <h2 className="reveal reveal-delay-1">Your transformation<br /><span className="italic">starts here.</span></h2>
            </div>
            <div className="right reveal reveal-delay-2">
              <p>Book your visit and pick up your luxury club keycard. Experience premium fitness designed specifically for your goals.</p>
            </div>
          </div>

          <div className="contact-grid">
            <form className="contact-form reveal" onSubmit={handleFormSubmit}>
              <div className="form-title">Join The Club</div>
              <p className="form-sub" style={{ marginBottom: '2rem' }}>Fill out the credentials below. Our guest concierge will reach out within 24 hours.</p>

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
                  Registration submitted successfully. Awaiting approval.
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
                <label>Full Name</label>
                <input 
                  type="text" 
                  placeholder="John Doe" 
                  value={form.fullName}
                  onChange={e => handleInputChange('fullName', e.target.value)}
                  required 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone Number</label>
                  <input 
                    type="tel" 
                    placeholder="+1 555-0199" 
                    value={form.phone}
                    onChange={e => handleInputChange('phone', e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Age</label>
                  <input 
                    type="number" 
                    placeholder="25" 
                    value={form.age}
                    onChange={e => handleInputChange('age', e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Gender</label>
                  <select 
                    value={form.gender}
                    onChange={e => handleInputChange('gender', e.target.value)}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Preferred Plan</label>
                  <select 
                    value={form.preferredSubscriptionId}
                    onChange={e => handleInputChange('preferredSubscriptionId', e.target.value)}
                  >
                    <option value="">Choose a membership...</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Height (cm)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 175" 
                    value={form.heightCm}
                    onChange={e => handleInputChange('heightCm', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Weight (kg)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 70" 
                    value={form.weightKg}
                    onChange={e => handleInputChange('weightKg', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Fitness Goal</label>
                <input 
                  type="text" 
                  placeholder="Muscle building, conditioning, general health..." 
                  value={form.fitnessGoal}
                  onChange={e => handleInputChange('fitnessGoal', e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label>Additional Notes</label>
                <textarea 
                  placeholder="Injuries, background experience, preferred scheduling..." 
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
                {formSubmitting ? 'Submitting Inquiry...' : 'Submit Application'}
                <span className="arrow">→</span>
              </button>
            </form>

            <div className="contact-info">
              <div className="info-card reveal" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>
                <div className="icon">☎</div>
                <div>
                  <div className="label">Call Us</div>
                  <div className="value">{settings?.phoneNumbers?.[0] || '+1 (555) 842-HERO'}</div>
                </div>
              </div>
              <div className="info-card reveal reveal-delay-1" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>
                <div className="icon">📍</div>
                <div>
                  <div className="label">Visit Us</div>
                  <div className="value">{settings?.address || '842 Athletic Ave, New York, NY 10013'}</div>
                </div>
              </div>
              <div className="info-card reveal reveal-delay-2" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>
                <div className="icon">✉</div>
                <div>
                  <div className="label">Email Us</div>
                  <div className="value">{settings?.socialLinks?.email || 'hello@herogym.club'}</div>
                </div>
              </div>
              <div className="info-card reveal reveal-delay-3" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>
                <div className="icon">⏰</div>
                <div>
                  <div className="label">Working Hours</div>
                  <div className="value">Mon–Sun · 24 hours / Members</div>
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
            <span>Limited Offer — Join This Month</span>
          </div>
          <h2 className="cta-title reveal reveal-delay-1">
            Stop waiting.<br />
            Start <span className="italic">forging.</span>
          </h2>
          <p className="cta-sub reveal reveal-delay-2">
            Your first session is complimentary. No contracts. No pressure. Just you, our coaches, and the first step toward the body you've earned.
          </p>
          <div className="cta-actions reveal reveal-delay-3">
            <a 
              href="#contact" 
              className="btn btn-primary"
              onMouseEnter={() => setCursorHover(true)} 
              onMouseLeave={() => setCursorHover(false)}
            >
              Claim Free Session
              <span className="arrow">→</span>
            </a>
            <a 
              href="tel:+15558424376" 
              className="btn btn-ghost"
              onMouseEnter={() => setCursorHover(true)} 
              onMouseLeave={() => setCursorHover(false)}
            >
              +1 (555) 842-HERO
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
              <p>Architecting transformations since 2014. A sanctuary for those who refuse ordinary — built for the relentless.</p>
            </div>
            <div className="footer-col">
              <h4>Explore</h4>
              <ul>
                <li><a href="#home" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>Home</a></li>
                <li><a href="#about" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>About Us</a></li>
                <li><a href="#gallery" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>Gallery</a></li>
                <li><a href="#membership" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>Memberships</a></li>
                <li><a href="#contact" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>Contact</a></li>
              </ul>
            </div>
            
            <div className="footer-col">
              <h4>Contact Details</h4>
              <ul>
                <li><a href="tel:+15558424376" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>+1 (555) 842-HERO</a></li>
                <li><a href="mailto:hello@herogym.club" onMouseEnter={() => setCursorHover(true)} onMouseLeave={() => setCursorHover(false)}>hello@herogym.club</a></li>
                <li><span style={{ color: 'var(--text-muted)' }}>842 Athletic Ave, NY</span></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} HERO GYM. All rights reserved. Crafted for the relentless.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
