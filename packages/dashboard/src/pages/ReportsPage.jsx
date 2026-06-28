import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useLanguage } from '../contexts/LanguageContext';
import './ReportsPage.css';

export default function ReportsPage() {
  const { token } = useAuth();
  const { showToast } = useModal();
  const { t } = useLanguage();
  const [selectedType, setSelectedType] = useState('revenue');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const REPORT_TYPES = [
    { value: 'revenue', label: t('reports.revenueReport') },
    { value: 'attendance', label: t('reports.attendanceReport') },
    { value: 'memberships', label: t('reports.membershipsReport') },
    { value: 'active-members', label: t('reports.activeMembersReport') },
    { value: 'expired-members', label: t('reports.expiredMembersReport') },
    { value: 'outstanding-payments', label: t('reports.outstandingPaymentsReport') }
  ];

  useEffect(() => {
    fetchPreview();
  }, [selectedType, startDate, endDate]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        type: selectedType,
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      });
      
      const res = await fetch(`/api/reports/preview?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to load report');
      }
      
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const query = new URLSearchParams({
        type: selectedType,
        format,
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      });
      
      const res = await fetch(`/api/reports/export?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to export report');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${selectedType}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast(t('toast.exportFailed') + `: ${err.message}`, 'error');
    }
  };

  const columns = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'id') : [];

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>{t('reports.title')}</h1>
        <p>{t('reports.subtitle')}</p>
      </div>

      <div className="reports-controls">
        <div className="control-group">
          <label>{t('reports.reportType')}</label>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            {REPORT_TYPES.map(rt => (
              <option key={rt.value} value={rt.value}>{rt.label}</option>
            ))}
          </select>
        </div>
        
        <div className="control-group">
          <label>{t('attendance.startDate')}</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
          />
        </div>
        
        <div className="control-group">
          <label>{t('attendance.endDate')}</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
          />
        </div>

        <div className="export-actions">
          <button 
            className="btn-export csv" 
            onClick={() => handleExport('csv')}
            disabled={loading || data.length === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            {t('reports.exportCsv')}
          </button>
          <button 
            className="btn-export excel" 
            onClick={() => handleExport('xlsx')}
            disabled={loading || data.length === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            {t('reports.exportXlsx')}
          </button>
        </div>
      </div>

      <div className="reports-preview">
        <div className="preview-header">
          <h2>{t('reports.dataPreview')}</h2>
          <span className="row-count">{t('reports.recordsCount', { count: data.length })}</span>
        </div>
        
        {loading ? (
          <div className="loading-spinner">{t('common.loading')}</div>
        ) : error ? (
          <div className="empty-state" style={{color: 'var(--status-rejected)'}}>
            {error}
          </div>
        ) : data.length === 0 ? (
          <div className="empty-state">
            {t('reports.noData')}
          </div>
        ) : (
          <div className="preview-table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id || Math.random()}>
                    {columns.map(col => (
                      <td key={col}>{row[col]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
