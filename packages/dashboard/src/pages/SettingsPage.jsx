import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './SettingsPage.css';

export default function SettingsPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  
  const [form, setForm] = useState({
    gymName: '',
    address: '',
    phoneNumbers: [''],
    socialLinks: {
      email: '',
      instagram: '',
      facebook: '',
      twitter: ''
    },
    landingPageContent: {
      about: ''
    },
    theme: 'system'
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const s = data.settings;
        setForm({
          gymName: s.gymName || '',
          address: s.address || '',
          phoneNumbers: Array.isArray(s.phoneNumbers) && s.phoneNumbers.length > 0 ? s.phoneNumbers : [''],
          socialLinks: {
            email: s.socialLinks?.email || '',
            instagram: s.socialLinks?.instagram || '',
            facebook: s.socialLinks?.facebook || '',
            twitter: s.socialLinks?.twitter || ''
          },
          landingPageContent: {
            about: s.landingPageContent?.about && typeof s.landingPageContent.about === 'object'
              ? `${s.landingPageContent.about.title || ''}\n\n${(s.landingPageContent.about.items || []).join('\n')}`.trim()
              : s.landingPageContent?.about || ''
          },
          theme: s.theme || 'system'
        });
      }
    } catch (err) {
      console.error('Failed to load settings', err);
      setMessage({ type: 'error', text: t('settings.loadFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (index, value) => {
    const newPhones = [...form.phoneNumbers];
    newPhones[index] = value;
    setForm({ ...form, phoneNumbers: newPhones });
  };

  const addPhone = () => {
    setForm({ ...form, phoneNumbers: [...form.phoneNumbers, ''] });
  };

  const removePhone = (index) => {
    if (form.phoneNumbers.length > 1) {
      const newPhones = form.phoneNumbers.filter((_, i) => i !== index);
      setForm({ ...form, phoneNumbers: newPhones });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    // Clean empty phone numbers
    const cleanedPhones = form.phoneNumbers.filter(p => p.trim() !== '');

    const updateData = {
      ...form,
      phoneNumbers: cleanedPhones.length > 0 ? cleanedPhones : ['']
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(updateData)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || t('settings.saveFailed'));
      }

      const data = await res.json();
      
      // Update form with saved data
      setForm(prev => ({
        ...prev,
        phoneNumbers: Array.isArray(data.settings.phoneNumbers) && data.settings.phoneNumbers.length > 0 
          ? data.settings.phoneNumbers 
          : ['']
      }));

      // Apply theme immediately
      if (updateData.theme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
      } else if (updateData.theme === 'light') {
        document.body.removeAttribute('data-theme');
      }

      setMessage({ type: 'success', text: t('settings.saved') });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="settings-page"><div className="loading-spinner">{t('common.loading')}</div></div>;

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>{t('settings.titleDetailed')}</h1>
        <p>{t('settings.subtitleDetailed')}</p>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="settings-form">
        
        <div className="settings-section">
          <h2>{t('settings.generalConfig')}</h2>
          <div className="form-row">
            <div className="form-group">
              <label>{t('settings.gymName')}</label>
              <input 
                type="text" 
                value={form.gymName} 
                onChange={e => setForm({...form, gymName: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>{t('settings.themeDashboard')}</label>
              <select 
                value={form.theme} 
                onChange={e => setForm({...form, theme: e.target.value})}
              >
                <option value="system">{t('settings.themeSystem')}</option>
                <option value="dark">{t('settings.themeDark')}</option>
                <option value="light">{t('settings.themeLight')}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>{t('settings.phoneNumbers')}</h2>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label>{t('settings.addressPhysical')}</label>
            <input 
              type="text" 
              value={form.address} 
              onChange={e => setForm({...form, address: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>{t('settings.phoneNumbers')}</label>
            <div className="phones-list">
              {form.phoneNumbers.map((phone, i) => (
                <div key={i} className="phone-input-row">
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={e => handlePhoneChange(i, e.target.value)}
                    placeholder="+1 (555) 000-0000"
                  />
                  {form.phoneNumbers.length > 1 && (
                    <button type="button" className="btn-icon" onClick={() => removePhone(i)} title="Remove number">✕</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn-add" onClick={addPhone}>{t('settings.addPhone')}</button>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>{t('settings.socialLinksHeading')}</h2>
          <div className="form-row">
            <div className="form-group">
              <label>{t('settings.socialEmail')}</label>
              <input 
                type="email" 
                value={form.socialLinks.email} 
                onChange={e => setForm({...form, socialLinks: {...form.socialLinks, email: e.target.value}})}
              />
            </div>
            <div className="form-group">
              <label>{t('settings.instagramUrl')}</label>
              <input 
                type="url" 
                value={form.socialLinks.instagram} 
                onChange={e => setForm({...form, socialLinks: {...form.socialLinks, instagram: e.target.value}})}
                placeholder="https://instagram.com/..."
              />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '1.5rem' }}>
            <div className="form-group">
              <label>{t('settings.facebookUrl')}</label>
              <input 
                type="url" 
                value={form.socialLinks.facebook} 
                onChange={e => setForm({...form, socialLinks: {...form.socialLinks, facebook: e.target.value}})}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div className="form-group">
              <label>{t('settings.twitterUrl')}</label>
              <input 
                type="url" 
                value={form.socialLinks.twitter} 
                onChange={e => setForm({...form, socialLinks: {...form.socialLinks, twitter: e.target.value}})}
                placeholder="https://twitter.com/..."
              />
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? t('settings.saving') : t('settings.saveSettings')}
          </button>
        </div>

      </form>
    </div>
  );
}
