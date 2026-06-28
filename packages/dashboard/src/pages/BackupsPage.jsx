import React, { useState, useEffect } from 'react';
import { useModal } from '../contexts/ModalContext';
import { useLanguage } from '../contexts/LanguageContext';
import './BackupsPage.css';

function BackupsPage() {
  const { showToast } = useModal();
  const { t } = useLanguage();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [error, setError] = useState('');

  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const fileInputRef = React.useRef(null);

  const fetchBackups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/backups', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch backups');
      const data = await response.json();
      setBackups(data);
    } catch (err) {
      console.error(err);
      setError('Could not load backup history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A';
    const b = parseInt(bytes, 10);
    if (b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      // Request download and also saves to server
      const response = await fetch('/api/backups/manual?download=true', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Backup failed');
      }

      // Handle file download
      const blob = await response.blob();
      
      // Try to get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      await fetchBackups(); // Refresh the list
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to trigger backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const executeRestoreOrImport = async () => {
    setIsRestoring(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      
      if (importFile) {
        // Handle Import Upload
        const formData = new FormData();
        formData.append('backupFile', importFile);
        
        const response = await fetch('/api/backups/import', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Import failed');
        }
        
        showToast(t('toast.importSuccess'), 'success');
        setImportFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else if (restoreTarget) {
        // Handle normal Restore
        const response = await fetch(`/api/backups/${restoreTarget}/restore`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Restore failed');
        }
        
        showToast(t('toast.restoreSuccess'), 'success');
        setRestoreTarget(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to restore database.');
      setRestoreTarget(null);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsRestoring(false);
    }
  };

  const closeModal = () => {
    setRestoreTarget(null);
    setImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) {
    return <div className="backups-page"><h2>{t('common.loading')}</h2></div>;
  }

  return (
    <div className="backups-page">
      <div className="backups-header">
        <h1>{t('backups.title')}</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="file" 
            accept=".json,.sql" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileChange}
          />
          <button 
            className="btn-backup" 
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={isBackingUp || isImporting}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          >
            <i className="fa-solid fa-file-import"></i> {t('backups.importBackup')}
          </button>
          
          <button 
            className="btn-backup" 
            onClick={handleManualBackup}
            disabled={isBackingUp}
          >
            {isBackingUp ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i> {t('backups.backingUp')}
              </>
            ) : (
              <>
                <i className="fa-solid fa-cloud-arrow-down"></i> {t('backups.backupNow')}
              </>
            )}
          </button>
        </div>
      </div>

      {error && <div className="error-message" style={{ color: '#ff4757', marginBottom: '1rem' }}>{error}</div>}

      <div className="backups-table-container">
        <table className="backups-table">
          <thead>
            <tr>
              <th>{t('common.date')}</th>
              <th>{t('backups.trigger')}</th>
              <th>{t('common.status')}</th>
              <th>{t('backups.size')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {backups.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                  {t('backups.noBackups')}
                </td>
              </tr>
            ) : (
              backups.map(backup => (
                <tr key={backup.id}>
                  <td>{new Date(backup.createdAt).toLocaleString()}</td>
                  <td>
                    <span className="trigger-badge">
                      {backup.triggeredBy}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${backup.status}`}>
                      {backup.status}
                    </span>
                  </td>
                  <td>{formatBytes(backup.sizeBytes)}</td>
                  <td>
                    {backup.status === 'success' && (
                      <button 
                        className="btn-restore"
                        onClick={() => setRestoreTarget(backup.id)}
                      >
                        <i className="fa-solid fa-clock-rotate-left"></i> {t('common.restore')}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(restoreTarget || importFile) && (
        <div className="modal-overlay">
          <div className="modal-content">
            <i className="fa-solid fa-triangle-exclamation modal-icon"></i>
            <h2 className="modal-title">{t('backups.warningTitle')}</h2>
            <p className="modal-text">
              {importFile 
                ? t('backups.importExplanation', { name: importFile.name })
                : t('backups.restoreExplanation')}
            </p>
            <div className="modal-actions">
              <button 
                className="btn-cancel" 
                onClick={closeModal}
                disabled={isRestoring}
              >
                {t('common.cancel')}
              </button>
              <button 
                className="btn-danger" 
                onClick={executeRestoreOrImport}
                disabled={isRestoring}
              >
                {isRestoring ? t('backups.restoring') : t('backups.restoreBackup')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BackupsPage;
