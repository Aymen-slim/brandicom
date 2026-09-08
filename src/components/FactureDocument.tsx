'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { InvoiceData, PaymentData } from '@/types';
import { formatMoney, VAT_RATE } from '@/lib/format';
import { Printer, ArrowLeft, CheckCircle2, Building2, Mail, Phone, MapPin, Calendar, CreditCard, Download } from 'lucide-react';

interface FactureDocumentProps {
  invoice: InvoiceData;
  payments: PaymentData[];
  isStandalonePage?: boolean;
  onClose?: () => void;
}

export function FactureDocument({
  invoice,
  payments = [],
  isStandalonePage = false,
  onClose,
}: FactureDocumentProps) {
  const isPaid = invoice.status === 'paid' || (invoice.paidAmount ?? 0) >= invoice.total;
  const isPartiallyPaid = !isPaid && (invoice.paidAmount ?? 0) > 0;
  const remaining = Math.max(0, invoice.total - (invoice.paidAmount || 0));
  const vatAmount = invoice.total - invoice.subtotal;
  const clientName = invoice.client?.name || invoice.clientName || 'Client Account';
  const clientLocation = invoice.client?.location;
  const clientContact = invoice.client?.contactName;
  const clientEmail = invoice.client?.contactEmail;
  const clientPhone = invoice.client?.contactPhone;
  const clientServices = invoice.client?.services && invoice.client.services.length > 0
    ? invoice.client.services
    : ['Marketing Strategy & Content Retainer'];

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="facture-container">
      {/* Top Action Toolbar (hidden during printing) */}
      <div className="facture-toolbar no-print">
        <div className="toolbar-left">
          {isStandalonePage ? (
            <Link href={`/finance/invoices/${invoice.id}`} className="btn btn-secondary btn-sm">
              <ArrowLeft size={14} /> Back to Invoice
            </Link>
          ) : (
            onClose && (
              <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
                <ArrowLeft size={14} /> Close
              </button>
            )
          )}
          <span className={`status-badge-pill ${isPaid ? 'paid' : isPartiallyPaid ? 'partially-paid' : 'pending'}`}>
            {isPaid ? '✓ Payée / Paid' : isPartiallyPaid ? 'Partiellement payée' : 'En attente / Due'}
          </span>
        </div>

        <div className="toolbar-right">
          <button type="button" onClick={handlePrint} className="btn btn-primary btn-sm">
            <Printer size={14} /> Imprimer / PDF
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="facture-sheet" id="printable-facture">
        {/* Header: Agency Info & Invoice Number */}
        <div className="facture-header">
          <div className="agency-branding">
            <div className="agency-logo-row">
              <div className="agency-logo-badge">
                <Image
                  src="/logo.png"
                  alt="Brandicom"
                  width={38}
                  height={38}
                  unoptimized
                  className="agency-logo-img"
                />
              </div>
              <div>
                <h1 className="agency-title">Brandicom</h1>
                <p className="agency-subtitle">Creative Growth & Marketing Agency</p>
              </div>
            </div>
            <div className="agency-meta-text">
              <p>Brandicom Studio SARL</p>
              <p>Tunis & International / Remote</p>
              <p>contact@brandicom.agency · +216 71 890 120</p>
              <p>MF: 1689241/A/M/000 · TVA: Non exonérée</p>
            </div>
          </div>

          <div className="facture-meta-box">
            <div className="facture-title-banner">FACTURE</div>
            <div className="facture-meta-grid">
              <div className="meta-label">Numéro :</div>
              <div className="meta-val highlight">{invoice.number}</div>

              <div className="meta-label">Date d&apos;émission :</div>
              <div className="meta-val">{invoice.issueDate}</div>

              <div className="meta-label">Échéance :</div>
              <div className="meta-val">{invoice.dueDate || 'À réception'}</div>

              <div className="meta-label">Période :</div>
              <div className="meta-val">{invoice.periodLabel || 'Mensuel'}</div>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="facture-divider" />

        {/* Client & Billing Info */}
        <div className="facture-parties-grid">
          <div className="parties-card client-card">
            <div className="parties-header">
              <Building2 size={14} /> Facturé à / Billed To:
            </div>
            <h2 className="client-brand-name">{clientName}</h2>

            <div className="client-contact-details">
              {clientContact && (
                <div className="detail-row">
                  <span className="detail-label">Contact:</span>
                  <span className="detail-value">{clientContact}</span>
                </div>
              )}
              {clientEmail && (
                <div className="detail-row">
                  <Mail size={12} className="detail-icon" />
                  <span className="detail-value">{clientEmail}</span>
                </div>
              )}
              {clientPhone && (
                <div className="detail-row">
                  <Phone size={12} className="detail-icon" />
                  <span className="detail-value">{clientPhone}</span>
                </div>
              )}
              {clientLocation && (
                <div className="detail-row">
                  <MapPin size={12} className="detail-icon" />
                  <span className="detail-value">{clientLocation}</span>
                </div>
              )}
            </div>
          </div>

          <div className="parties-card payment-status-card">
            <div className="parties-header">
              <CreditCard size={14} /> État du Règlement / Payment Status:
            </div>

            {isPaid ? (
              <div className="stamp-box paid-stamp">
                <CheckCircle2 size={24} color="#059669" />
                <div>
                  <div className="stamp-text">PAYÉ / FULLY PAID</div>
                  <div className="stamp-sub">
                    Règlement complet reçu le {payments[payments.length - 1]?.paidAt || invoice.issueDate}
                  </div>
                </div>
              </div>
            ) : isPartiallyPaid ? (
              <div className="stamp-box partially-paid-stamp">
                <div className="stamp-text" style={{ color: '#d97706' }}>
                  ACOMPTE VERSÉ / PARTIALLY PAID
                </div>
                <div className="stamp-sub">
                  Reste à payer : <strong>{formatMoney(remaining)}</strong>
                </div>
              </div>
            ) : (
              <div className="stamp-box pending-stamp">
                <div className="stamp-text" style={{ color: '#6366f1' }}>
                  EN ATTENTE / PENDING PAYMENT
                </div>
                <div className="stamp-sub">
                  Montant dû : <strong>{formatMoney(invoice.total)}</strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Services / Line Items Table */}
        <div className="facture-table-wrap">
          <table className="facture-table">
            <thead>
              <tr>
                <th style={{ width: '55%' }}>Description des Prestations</th>
                <th style={{ width: '15%', textAlign: 'center' }}>Qté</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Prix Unitaire HT</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Total HT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="service-title">
                    Prestation de Retainer Marketing & Création de Contenu
                  </div>
                  <div className="service-sub">
                    Période: {invoice.periodLabel || 'Prestations en cours'}
                  </div>
                  <div className="service-tags">
                    {clientServices.map((svc, sIdx) => (
                      <span key={sIdx} className="service-pill">
                        {svc}
                      </span>
                    ))}
                  </div>
                  {invoice.notes && (
                    <div className="service-notes">
                      Note: {invoice.notes}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '14px' }}>1</td>
                <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: '14px', fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(invoice.subtotal)}
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: '14px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(invoice.subtotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="facture-totals-section">
          <div className="totals-left-notes">
            <p className="legal-title">Modalités de paiement :</p>
            <p className="legal-text">
              Virement bancaire au profit de <strong>Brandicom Studio SARL</strong>.
            </p>
            <p className="legal-text">
              RIB: <strong>08 123 00019284758 45</strong> (BIAT Tunis Centre)
            </p>
            <p className="legal-text">
              Toute réclamation doit être notifiée par écrit sous 8 jours à compter de la réception de la facture.
            </p>
          </div>

          <div className="totals-right-table">
            <div className="total-row">
              <span className="total-label">Total HT (Hors Taxe) :</span>
              <span className="total-value">{formatMoney(invoice.subtotal)}</span>
            </div>
            <div className="total-row">
              <span className="total-label">
                TVA ({Math.round((invoice.vatRate ?? VAT_RATE) * 100)}%
                {(invoice.vatRate ?? VAT_RATE) === 0 ? ' - Exonérée' : ''}) :
              </span>
              <span className="total-value">{formatMoney(vatAmount)}</span>
            </div>
            <div className="total-row grand-total">
              <span className="total-label">Total TTC à Payer :</span>
              <span className="total-value">{formatMoney(invoice.total)}</span>
            </div>

            {/* Payment history deduction */}
            <div className="total-row paid-row">
              <span className="total-label">Total Réglé / Received :</span>
              <span className="total-value text-success">
                {formatMoney(invoice.paidAmount || 0)}
              </span>
            </div>
            <div className="total-row balance-row">
              <span className="total-label">Solde Restant Dû :</span>
              <span className="total-value highlight-balance">
                {formatMoney(remaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Payment History if any payments exist */}
        {payments.length > 0 && (
          <div className="facture-payments-history">
            <div className="payments-history-title">
              Historique des Règlements Encaissés ({payments.length})
            </div>
            <table className="payments-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Référence</th>
                  <th style={{ textAlign: 'right' }}>Montant Réglé</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paidAt}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {p.method.replace('_', ' ')}
                    </td>
                    <td>{p.reference || 'Virement direct'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                      {formatMoney(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer & Signature / Stamp */}
        <div className="facture-footer">
          <div className="footer-left">
            <p>Brandicom Studio SARL — Capital 10,000 TND</p>
            <p>Siège social: Les Berges du Lac, Tunis · RC: B01982732024</p>
          </div>

          <div className="footer-signature-box">
            <div className="signature-header">Cachet & Signature Brandicom</div>
            <div className="signature-stamp-placeholder">
              {isPaid && <div className="stamp-ring">PAID & CERTIFIED</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
