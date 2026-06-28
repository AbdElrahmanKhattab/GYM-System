import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, CartesianGrid 
} from 'recharts';
import { Link } from 'react-router-dom';

// Custom Tooltip component for a high-end look
const CustomTooltip = ({ active, payload, label, prefix = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        borderRadius: '12px',
        padding: '0.8rem 1rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
      }}>
        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          {prefix}{payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

export default function DashboardHomePage() {
  const { token, user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to load dashboard stats', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [token]);

  // Determine greeting based on current time
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return t('dashboard.goodMorning');
    if (hours < 18) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="page-container" style={{ paddingBottom: '4rem', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* Premium Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2.5rem',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        padding: '2rem',
        borderRadius: '24px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.02)'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '2.25rem', 
            fontWeight: 800, 
            letterSpacing: '-0.03em', 
            background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.4rem'
          }}>
            {getGreeting()}, {user?.fullName?.split(' ')[0] || 'Admin'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500 }}>
            {t('dashboard.welcomeSubtitle')}
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'white',
          padding: '0.6rem 1.2rem',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('dashboard.systemActive')}</span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <MetricCard 
          title={t('dashboard.todayAttendance')} 
          value={stats.todayAttendanceCount} 
          subValue={t('dashboard.checkinsToday')}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          }
          iconColor="#10b981"
          iconBg="rgba(16, 185, 129, 0.1)"
          link="/attendance"
        />
        <MetricCard 
          title={t('dashboard.activeMembers')} 
          value={stats.activeMembersCount} 
          subValue={t('dashboard.expiredMembershipsCount', { count: stats.expiredMembersCount })}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
          iconColor="#4f46e5"
          iconBg="rgba(79, 70, 229, 0.1)"
          link="/members"
        />
        <MetricCard 
          title={t('dashboard.pendingRegistrations')} 
          value={stats.pendingRegistrationsCount} 
          subValue={stats.pendingRegistrationsCount > 0 ? t('dashboard.requiresAction') : t('dashboard.allApprovalsCleared')}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          }
          iconColor={stats.pendingRegistrationsCount > 0 ? "#f59e0b" : "#64748b"}
          iconBg={stats.pendingRegistrationsCount > 0 ? "rgba(245, 158, 11, 0.1)" : "rgba(100, 116, 139, 0.1)"}
          link="/new-customers"
        />
        {isAdmin && (
          <MetricCard 
            title={t('dashboard.monthlyRevenue')} 
            value={`$${stats.monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} 
            subValue={t('dashboard.outstanding', { amount: stats.outstandingPaymentsTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) })}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            }
            iconColor="#0ea5e9"
            iconBg="rgba(14, 165, 233, 0.1)"
            link="/payments"
          />
        )}
      </div>

      {/* Charts Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
        gap: '2rem'
      }}>
        
        {/* Weekly Attendance */}
        <div className="card" style={{ 
          padding: '2rem', 
          borderRadius: '24px',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.03)'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{t('dashboard.weeklyAttendance')}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('dashboard.weeklySubtitle')}</p>
          </div>
          <div style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={stats.attendanceChart} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }} />
                <Tooltip cursor={{ fill: 'rgba(79, 70, 229, 0.03)', radius: 8 }} content={<CustomTooltip />} />
                <Bar dataKey="count" fill="var(--accent-primary)" radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Revenue Trend */}
        {isAdmin && (
          <div className="card" style={{ 
            padding: '2rem', 
            borderRadius: '24px',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.03)'
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{t('dashboard.revenueOverview')}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('dashboard.revenueSubtitle')}</p>
            </div>
            <div style={{ height: '320px', width: '100%' }}>
              <ResponsiveContainer>
                <AreaChart data={stats.revenueChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenuePremium" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }} tickFormatter={(val) => `$${val}`} />
                  <Tooltip content={<CustomTooltip prefix="$" />} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3.5} fillOpacity={1} fill="url(#colorRevenuePremium)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function MetricCard({ title, value, subValue, icon, iconColor, iconBg, link }) {
  return (
    <Link to={link} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ 
        padding: '1.8rem', 
        borderRadius: '24px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.02)',
        display: 'flex', 
        alignItems: 'center',
        gap: '1.25rem',
        height: '100%',
        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s',
        cursor: 'pointer',
        background: '#ffffff',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)';
        e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.2)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0, 0, 0, 0.02)';
        e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.8)';
      }}
      >
        {/* Soft background line effect */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${iconBg} 0%, transparent 70%)`,
          opacity: 0.5,
          pointerEvents: 'none'
        }} />

        {/* Icon container */}
        <div style={{ 
          width: '56px', 
          height: '56px', 
          borderRadius: '16px', 
          backgroundColor: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor,
          flexShrink: 0
        }}>
          <div style={{ width: '28px', height: '28px' }}>
            {icon}
          </div>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ 
            fontSize: '0.8rem', 
            fontWeight: 700, 
            color: 'var(--text-muted)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em',
            marginBottom: '0.35rem'
          }}>
            {title}
          </span>
          <span style={{ 
            fontSize: '2.25rem', 
            fontWeight: 850, 
            color: 'var(--text-primary)', 
            lineHeight: 1.1,
            letterSpacing: '-0.04em',
            marginBottom: '0.25rem'
          }}>
            {value}
          </span>
          {subValue && (
            <span style={{ 
              fontSize: '0.8rem', 
              color: 'var(--text-secondary)', 
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {subValue}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
