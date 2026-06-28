import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './CreateMemberPage.css';

export default function CreateMemberPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [subscriptions, setSubscriptions] = useState([]);

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    gender: 'male',
    birthday: '',
    heightCm: '',
    weightKg: '',
    fitnessGoal: '',
    notes: '',
    emergencyContact: '',
    subscriptionId: '',
  });

  useEffect(() => {
    fetch('/api/subscriptions', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        const active = data.subscriptions.filter(s => s.isActive);
        setSubscriptions(active);
        if (active.length > 0) setForm(f => ({ ...f, subscriptionId: active[0].id }));
      });
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to create member');

      navigate(`/members/${data.member.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <button className="btn-back" onClick={() => navigate('/members')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        {t('members.backToMembers')}
      </button>

      <div className="create-card">
        <h2>{t('members.addMember')}</h2>
        <p className="text-muted">{t('members.addMemberDirectExplanation')}</p>

        <form onSubmit={handleSubmit} className="create-form">
          {error && <div className="alert-error">{error}</div>}

          <div className="form-section">
            <h3>{t('members.personalInfo')}</h3>
            <div className="form-row">
              <div className="form-group">
                <label>{t('members.fullName')} *</label>
                <input name="fullName" value={form.fullName} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>{t('common.phone')} *</label>
                <input name="phone" value={form.phone} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t('members.gender')} *</label>
                <select name="gender" value={form.gender} onChange={handleChange}>
                  <option value="male">{t('members.male')}</option>
                  <option value="female">{t('members.female')}</option>
                  <option value="other">{t('members.other')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('members.birthday')}</label>
                <input type="date" name="birthday" value={form.birthday} onChange={handleChange} />
              </div>
            </div>
            <div className="form-group">
              <label>{t('members.emergencyContact')}</label>
              <input name="emergencyContact" value={form.emergencyContact} onChange={handleChange} placeholder={t('common.phone')} />
            </div>
          </div>

          <div className="form-section">
            <h3>{t('members.bodyMetrics')}</h3>
            <div className="form-row">
              <div className="form-group">
                <label>{t('members.height')} (cm)</label>
                <input type="number" step="0.1" name="heightCm" value={form.heightCm} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>{t('members.weight')} (kg)</label>
                <input type="number" step="0.1" name="weightKg" value={form.weightKg} onChange={handleChange} />
              </div>
            </div>
            <div className="form-group">
              <label>{t('members.fitnessGoal')}</label>
              <textarea name="fitnessGoal" value={form.fitnessGoal} onChange={handleChange} rows={2} />
            </div>
          </div>

          <div className="form-section">
            <h3>{t('members.subscriptionPlan')}</h3>
            <div className="form-group">
              <label>{t('members.plan')} *</label>
              <select name="subscriptionId" value={form.subscriptionId} onChange={handleChange} required>
                {subscriptions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — ${Number(s.price).toFixed(2)} ({s.durationValue} {s.durationType})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('common.notes')}</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="..." />
            </div>
          </div>

          <div className="form-footer">
            <button type="button" className="btn-secondary" onClick={() => navigate('/members')} disabled={loading}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? t('members.creating') : t('members.createMember')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
