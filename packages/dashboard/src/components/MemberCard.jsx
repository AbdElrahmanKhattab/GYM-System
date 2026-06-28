import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './MemberCard.css';

/**
 * MemberCard — a print-optimized membership card component.
 * Renders the member's photo, name, QR code (from qrToken), and manual code.
 * Supports a modal mode or an inline dashboard-embedded mode.
 * 
 * Props:
 *   member: { fullName, qrToken, manualCode, photoUrl, phone, status, joinDate, createdAt }
 *   gymName: string (optional, defaults to gym brand)
 *   onClose: () => void (required for modal mode)
 *   inline: boolean (if true, renders without modal overlay)
 */
export default function MemberCard({ member, gymName = 'IRON TEMPLE GYM', onClose, inline = false }) {
  const cardRef = useRef(null);

  const handlePrint = () => {
    window.print();
  };

  if (!member) return null;

  const cardContent = (
    <div className={`membership-card-wrapper ${inline ? 'is-inline' : ''}`}>
      {/* Action bar — hidden when printing */}
      {!inline && (
        <div className="card-actions no-print">
          <button className="btn-primary" onClick={handlePrint}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print Member Card
          </button>
          {onClose && <button className="btn-secondary" onClick={onClose}>Close</button>}
        </div>
      )}

      {/* The physical membership card */}
      <div className="membership-card" ref={cardRef}>
        {/* Holographic glowing line */}
        <div className="card-holo-stripe"></div>

        {/* Card Header: Gym Logo & Brand */}
        <div className="card-header-row">
          <div className="card-brand">
            <svg className="card-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5"/>
              <circle cx="12" cy="12" r="10"/>
            </svg>
            <div className="card-brand-text">
              <span className="card-gym-name">{gymName}</span>
              <span className="card-gym-tag">ELITE MEMBERSHIP</span>
            </div>
          </div>
          <div className="card-status-badge">
            <span className={`status-dot ${member.status}`}></span>
            {member.status?.replace('_', ' ')?.toUpperCase()}
          </div>
        </div>

        {/* Card Body: Info Left, QR Right */}
        <div className="card-body-row">
          <div className="card-left-col">
            <div className="card-info-group">
              <label>MEMBER NAME</label>
              <h2 className="card-member-name">{member.fullName}</h2>
            </div>
            
            <div className="card-info-group">
              <label>MEMBERSHIP PLAN</label>
              <p className="card-member-plan">
                {member.memberSubscriptions?.find(t => t.isCurrent)?.subscription?.name || 'NO ACTIVE PLAN'}
              </p>
            </div>

            <div className="card-info-row-compact">
              <div className="card-info-group">
                <label>MEMBER CODE</label>
                <p className="card-manual-code">{member.manualCode}</p>
              </div>
              <div className="card-info-group">
                <label>PHONE</label>
                <p className="card-member-phone">{member.phone}</p>
              </div>
            </div>
          </div>

          <div className="card-right-col">
            <div className="card-qr-wrapper">
              <QRCodeSVG
                value={member.qrToken}
                size={125}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="H"
                includeMargin={true}
              />
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="card-footer-row">
          <span className="card-footer-text">
            JOIN DATE: {new Date(member.joinDate || member.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }).toUpperCase()}
          </span>
          <span className="card-footer-signature">AUTHORIZED SIGNATURE</span>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return cardContent;
  }

  return (
    <div className="card-modal-overlay">
      <div className="card-modal-content">
        {cardContent}
      </div>
    </div>
  );
}
