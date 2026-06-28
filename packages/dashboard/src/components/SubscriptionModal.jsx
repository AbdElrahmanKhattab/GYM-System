import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './SubscriptionModal.css';

export default function SubscriptionModal({ subscription, onClose }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!subscription;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    durationType: 'months',
    durationValue: 1,
    freezeAllowed: false,
    allowMultipleCheckinsPerDay: false,
    displayOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    if (subscription) {
      setFormData({
        name: subscription.name || '',
        description: subscription.description || '',
        price: subscription.price || '',
        durationType: subscription.durationType || 'months',
        durationValue: subscription.durationValue || 1,
        freezeAllowed: subscription.freezeAllowed || false,
        allowMultipleCheckinsPerDay: subscription.allowMultipleCheckinsPerDay || false,
        displayOrder: subscription.displayOrder || 0,
        isActive: subscription.isActive ?? true,
      });
    }
  }, [subscription]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateForm = () => {
    if (Number(formData.price) < 0) return 'Price cannot be negative.';
    if (Number(formData.durationValue) <= 0 || !Number.isInteger(Number(formData.durationValue))) {
      return 'Duration value must be a positive integer.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const url = isEditing ? `/api/subscriptions/${subscription.id}` : '/api/subscriptions';
      const method = isEditing ? 'PATCH' : 'POST';

      const payload = {
        ...formData,
        price: Number(formData.price),
        durationValue: Number(formData.durationValue),
        displayOrder: Number(formData.displayOrder),
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to save subscription');
      }

      onClose(true); // Saved successfully
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Plan' : 'New Plan'}</h2>
          <button className="btn-close" onClick={() => onClose(false)}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. 1 Month Plan"
                required
              />
            </div>
            <div className="form-group">
              <label>Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Features included in this plan..."
              rows={2}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Duration Value</label>
              <input
                type="number"
                min="1"
                name="durationValue"
                value={formData.durationValue}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Duration Type</label>
              <select name="durationType" value={formData.durationType} onChange={handleChange}>
                <option value="months">Months</option>
                <option value="days">Days</option>
                <option value="sessions">Sessions</option>
              </select>
            </div>
          </div>

          <div className="form-row align-center mt-2">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="freezeAllowed"
                checked={formData.freezeAllowed}
                onChange={handleChange}
              />
              Allow freezing this membership
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="allowMultipleCheckinsPerDay"
                checked={formData.allowMultipleCheckinsPerDay}
                onChange={handleChange}
              />
              Allow multiple check-ins/day
            </label>
          </div>
          <div className="form-row align-center mt-2">
            {isEditing && (
              <label className="checkbox-label text-warning">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                Active (available to public)
              </label>
            )}
          </div>

          <div className="form-group mt-2">
            <label>Display Order</label>
            <input
              type="number"
              name="displayOrder"
              value={formData.displayOrder}
              onChange={handleChange}
              placeholder="0 (lowest appears first)"
            />
            <small className="text-muted">Controls the order this appears on the landing page.</small>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => onClose(false)} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
