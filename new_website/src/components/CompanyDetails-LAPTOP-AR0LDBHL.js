import React, { useState, useEffect } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from './Button';
import Badge from './Badge';

function CompanyDetails({ 
  companyNumber, 
  apiBasePath = '/api/verification/company', 
  onAutoImport,
  onSelectedDocumentsChange,
  saveSelectedDocumentsRef,
  hideAutoImport = false,
}) {
  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [downloading, setDownloading] = useState(null);
  const [autoImporting, setAutoImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (companyNumber) {
      loadCompanyDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyNumber]);

  const loadCompanyDetails = async () => {
    if (!companyNumber) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`${apiBasePath}/get_full_company_details/`, {
        params: { company_number: companyNumber }
      });
      setCompanyData(response.data);
    } catch (err) {
      console.error('Failed to load company details:', err);
      setError(err.response?.data?.error || 'Failed to load company details');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentToggle = (doc, category) => {
    setSelectedDocuments(prev => {
      const existing = prev.findIndex(d => d.transaction_id === doc.transaction_id && d.type === category);
      let newSelection;
      if (existing >= 0) {
        newSelection = prev.filter((_, i) => i !== existing);
      } else {
        newSelection = [...prev, { transaction_id: doc.transaction_id, type: category, ...doc }];
      }
      // Notify parent of selection changes
      if (onSelectedDocumentsChange) {
        onSelectedDocumentsChange(newSelection);
      }
      return newSelection;
    });
  };

  // Expose save method via ref
  useEffect(() => {
    if (saveSelectedDocumentsRef) {
      saveSelectedDocumentsRef.current = async () => {
        return await saveSelectedDocuments();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSelectedDocumentsRef, companyNumber]); // selectedDocuments is captured via closure

  const saveSelectedDocuments = async () => {
    if (selectedDocuments.length === 0) {
      return { success: true, saved: 0, failed: 0, errors: [] };
    }

    const results = {
      success: true,
      saved: 0,
      failed: 0,
      errors: []
    };

    // Process each document with error handling
    for (const doc of selectedDocuments) {
      try {
        // Download the document
        const downloadResponse = await api.post(`${apiBasePath}/download_company_document/`, {
          company_number: companyNumber,
          transaction_id: doc.transaction_id,
        });

        if (downloadResponse.data.document_data) {
          // Save to profile
          await api.post('/api/borrowers/save-company-document/', {
            company_number: companyNumber,
            document_data: downloadResponse.data.document_data,
            filename: downloadResponse.data.filename || `${doc.description || 'document'}.pdf`,
            content_type: downloadResponse.data.content_type || 'application/pdf',
            document_type_name: doc.description || 'Companies House Document',
            category: doc.type || 'company',
          });
          results.saved++;
        } else {
          results.failed++;
          results.errors.push({
            document: doc.description || doc.transaction_id,
            error: 'Document data not available'
          });
        }
      } catch (err) {
        console.error(`Failed to save document ${doc.description || doc.transaction_id}:`, err);
        results.failed++;
        results.success = false;
        results.errors.push({
          document: doc.description || doc.transaction_id,
          error: err.response?.data?.error || err.message || 'Failed to download or save document'
        });
      }
    }

    // Clear selected documents if all were saved successfully
    if (results.failed === 0) {
      setSelectedDocuments([]);
      if (onSelectedDocumentsChange) {
        onSelectedDocumentsChange([]);
      }
    }

    return results;
  };

  const handleDownloadDocument = async (doc, category, saveToProfile = false) => {
    const docKey = `${category}_${doc.transaction_id}`;
    setDownloading(docKey);
    setError(null);
    try {
      const response = await api.post(`${apiBasePath}/download_company_document/`, {
        company_number: companyNumber,
        transaction_id: doc.transaction_id,
      });

      if (response.data.document_data) {
        const byteCharacters = atob(response.data.document_data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: response.data.content_type || 'application/pdf' });
        
        // Download to browser
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.data.filename || `${doc.description || 'document'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Save to profile if requested
        if (saveToProfile) {
          try {
            await api.post('/api/borrowers/save_company_document/', {
              company_number: companyNumber,
              transaction_id: doc.transaction_id,
              document_data: response.data.document_data,
              filename: response.data.filename || `${doc.description || 'document'}.pdf`,
              content_type: response.data.content_type || 'application/pdf',
              document_type: category,
              description: doc.description || 'Document from Companies House',
            });
            // Show success message
            setMessage(`Document "${doc.description || 'document'}" saved to your profile and will be available for future applications.`);
          } catch (err) {
            console.error('Failed to save document to profile:', err);
            setError(err.response?.data?.error || 'Document downloaded but failed to save to profile');
          }
        }
      } else {
        setError('Document data not available');
      }
    } catch (err) {
      console.error('Failed to download document:', err);
      setError(err.response?.data?.error || 'Failed to download document');
    } finally {
      setDownloading(null);
    }
  };

  const handleAutoImport = async () => {
    if (!companyNumber) {
      setError('Company number is required');
      return;
    }

    setAutoImporting(true);
    setError(null);
    setImportResult(null);
    
    try {
      // Call the auto-import endpoint
      const response = await api.post('/api/borrowers/verify-and-import-company/', {
        company_number: companyNumber,
      });

      // Backend returns 'message' and 'results', not 'success'
      if (response.data.message && !response.data.error) {
        setImportResult(response.data);
        // Call the onAutoImport callback if provided
        if (onAutoImport) {
          onAutoImport(response.data);
        }
      } else {
        setError(response.data.error || response.data.message || 'Failed to import company data');
      }
    } catch (err) {
      console.error('Failed to auto-import company data:', err);
      setError(err.response?.data?.error || 'Failed to auto-import company data');
    } finally {
      setAutoImporting(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderDocumentGroup = (title, documents, category) => {
    if (!documents || documents.length === 0) return null;

    const isExpanded = expandedSections[category] !== false; // Default to expanded
    const sectionKey = category;

    return (
      <div style={{ marginBottom: theme.spacing.lg }}>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            padding: theme.spacing.sm,
            borderRadius: theme.borderRadius.md,
            background: theme.colors.gray50,
            marginBottom: theme.spacing.sm,
          }}
          onClick={() => toggleSection(sectionKey)}
        >
          <h3 style={{
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.semibold,
            margin: 0,
            color: theme.colors.textPrimary,
          }}>
            {title} ({documents.length})
          </h3>
          <span style={{
            fontSize: theme.typography.fontSize.xl,
            color: theme.colors.textSecondary,
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>
            ▼
          </span>
        </div>
        {isExpanded && (
          <div style={{
            display: 'grid',
            gap: theme.spacing.sm,
          }}>
          {documents.map((doc) => {
            const docKey = `${category}_${doc.transaction_id}`;
            const isSelected = selectedDocuments.find(d => d.transaction_id === doc.transaction_id && d.type === category);
            const isDownloading = downloading === docKey;

            return (
              <div
                key={doc.transaction_id}
                style={{
                  ...commonStyles.card,
                  padding: theme.spacing.md,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => handleDocumentToggle(doc, category)}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: theme.colors.primary,
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: theme.typography.fontWeight.medium }}>
                        {doc.description || 'Document'}
                      </div>
                      <div style={{
                        fontSize: theme.typography.fontSize.sm,
                        color: theme.colors.textSecondary,
                        marginTop: theme.spacing.xs,
                      }}>
                        {doc.date ? new Date(doc.date).toLocaleDateString() : 'Date not available'}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadDocument(doc, category, false)}
                    disabled={isDownloading}
                    loading={isDownloading}
                  >
                    {isDownloading === `${category}_${doc.transaction_id}` ? 'Downloading...' : 'Download'}
                  </Button>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
    );
  };

  if (!companyNumber) {
    return (
      <div style={commonStyles.card}>
        <p style={{ color: theme.colors.textSecondary }}>Please enter a company number to view details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={commonStyles.card}>
        <p style={{ color: theme.colors.textSecondary }}>Loading company details...</p>
      </div>
    );
  }

  if (error && !companyData) {
    return (
      <div style={commonStyles.card}>
        <p style={{ color: theme.colors.error }}>{error}</p>
        <Button onClick={loadCompanyDetails} variant="outline" style={{ marginTop: theme.spacing.md }}>
          Retry
        </Button>
      </div>
    );
  }

  if (!companyData) {
    return null;
  }

  const address = companyData.registered_address || {};
  const formattedAddress = [
    address.address_line_1,
    address.address_line_2,
    address.locality,
    address.postal_code,
    address.country,
  ].filter(Boolean).join(', ');

  return (
    <div>
      {error && (
        <div style={{
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
          border: `1px solid ${theme.colors.error}`,
        }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{
          background: theme.colors.successLight,
          color: theme.colors.successDark,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
          border: `1px solid ${theme.colors.success}`,
        }}>
          {message}
        </div>
      )}

      {/* Company Info */}
      <div style={commonStyles.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.bold,
              margin: 0,
              color: theme.colors.textPrimary,
            }}>
              {companyData.company_name}
            </h2>
            <Badge variant="success">Verified via Companies House</Badge>
          </div>
          {!hideAutoImport && (
            <Button
              variant="primary"
              onClick={handleAutoImport}
              loading={autoImporting}
              disabled={autoImporting}
            >
              {autoImporting ? 'Importing...' : 'Auto-Import All Data'}
            </Button>
          )}
          {hideAutoImport && (
            <Badge variant="info">Company data already imported</Badge>
          )}
        </div>
        
        {importResult && (
          <div style={{
            background: theme.colors.successLight,
            color: theme.colors.successDark,
            padding: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.lg,
            border: `1px solid ${theme.colors.success}`,
          }}>
            <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
              ✓ Company data imported successfully!
            </p>
            {importResult.results && (
              <ul style={{ margin: `${theme.spacing.sm} 0 0 ${theme.spacing.lg}`, padding: 0 }}>
                <li>{importResult.results.directors_count || 0} directors imported</li>
                <li>{importResult.results.shareholders_count || 0} shareholders imported</li>
                <li>{importResult.results.accounts_documents_saved || 0} accounts documents saved</li>
              </ul>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
          <div>
            <strong>Company Number:</strong> {companyData.company_number}
          </div>
          <div>
            <strong>Company Type:</strong> {companyData.company_type || 'N/A'}
          </div>
          <div>
            <strong>Status:</strong> {companyData.company_status || 'N/A'}
          </div>
          {companyData.incorporation_date && (
            <div>
              <strong>Incorporation Date:</strong> {new Date(companyData.incorporation_date).toLocaleDateString()}
            </div>
          )}
          {formattedAddress && (
            <div>
              <strong>Registered Address:</strong> {formattedAddress}
            </div>
          )}
        </div>
      </div>

      {/* Active Directors */}
      {companyData.directors && companyData.directors.length > 0 && (
        <div style={commonStyles.card}>
          <h3 style={{
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.semibold,
            marginBottom: theme.spacing.md,
            color: theme.colors.textPrimary,
          }}>
            Active Directors
          </h3>
          <div style={{ display: 'grid', gap: theme.spacing.sm }}>
            {companyData.directors.map((director, index) => (
              <div key={index} style={{
                padding: theme.spacing.sm,
                background: theme.colors.gray50,
                borderRadius: theme.borderRadius.md,
              }}>
                <div style={{ fontWeight: theme.typography.fontWeight.medium }}>
                  {director.name || 'N/A'}
                </div>
                {director.nationality && (
                  <div style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.textSecondary,
                    marginTop: theme.spacing.xs,
                  }}>
                    Nationality: {director.nationality}
                  </div>
                )}
                {director.occupation && (
                  <div style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.textSecondary,
                  }}>
                    Occupation: {director.occupation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shareholders/PSCs */}
      {companyData.pscs && companyData.pscs.length > 0 && (
        <div style={commonStyles.card}>
          <h3 style={{
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.semibold,
            marginBottom: theme.spacing.md,
            color: theme.colors.textPrimary,
          }}>
            Persons with Significant Control
          </h3>
          <div style={{ display: 'grid', gap: theme.spacing.sm }}>
            {companyData.pscs.map((psc, index) => (
              <div key={index} style={{
                padding: theme.spacing.sm,
                background: theme.colors.gray50,
                borderRadius: theme.borderRadius.md,
              }}>
                <div style={{ fontWeight: theme.typography.fontWeight.medium }}>
                  {psc.name || 'N/A'}
                </div>
                {psc.kind && (
                  <div style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.textSecondary,
                    marginTop: theme.spacing.xs,
                  }}>
                    Type: {psc.kind}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charges Summary */}
      {companyData.charges_summary && companyData.charges_summary.total_charges > 0 && (
        <div style={commonStyles.card}>
          <h3 style={{
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.semibold,
            marginBottom: theme.spacing.md,
            color: theme.colors.textPrimary,
          }}>
            Company Charges Summary
          </h3>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
            {companyData.charges_summary.total_charges} total charge(s) registered against the company.
            {companyData.charges_summary.active_charges > 0 && (
              <span style={{ color: theme.colors.warning, fontWeight: theme.typography.fontWeight.medium }}>
                {' '}{companyData.charges_summary.active_charges} active charge(s).
              </span>
            )}
          </p>
          {companyData.charges_summary.charges && companyData.charges_summary.charges.length > 0 && (
            <div style={{ display: 'grid', gap: theme.spacing.sm }}>
              {companyData.charges_summary.charges.slice(0, 5).map((charge, index) => (
                <div key={index} style={{
                  padding: theme.spacing.sm,
                  background: theme.colors.gray50,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${charge.status === 'active' ? theme.colors.warning : theme.colors.gray200}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: theme.typography.fontWeight.medium }}>
                        {charge.charge_code || charge.charge_number || 'Charge'}
                      </div>
                      {charge.created_on && (
                        <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
                          Created: {new Date(charge.created_on).toLocaleDateString()}
                        </div>
                      )}
                      {charge.persons_entitled && charge.persons_entitled.length > 0 && (
                        <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
                          Charged to: {charge.persons_entitled.map(p => p.name).join(', ')}
                        </div>
                      )}
                    </div>
                    <Badge variant={charge.status === 'active' ? 'warning' : 'success'}>
                      {charge.status || 'Unknown'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Documents Section with Tip */}
      {(companyData.documents || companyData.incorporation_certificates || companyData.accounts_documents) && (
        <div style={commonStyles.card}>
          <div style={{
            background: theme.colors.primaryLight,
            border: `1px solid ${theme.colors.primary}`,
            borderRadius: theme.borderRadius.md,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.lg,
          }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: theme.spacing.sm }}>
              <span style={{ fontSize: theme.typography.fontSize.xl }}>💡</span>
              <div>
                <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.primaryDark }}>
                  Save Documents to Your Profile
                </p>
                <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                  Documents saved to your profile (like certificates of incorporation and accounts) will be automatically available when creating funding applications. This saves time and ensures you always have the latest verified documents ready.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
            <h3 style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              margin: 0,
              color: theme.colors.textPrimary,
            }}>
              Available Documents
            </h3>
            {selectedDocuments.length > 0 && (
              <Badge variant="info">
                {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} selected
              </Badge>
            )}
          </div>
          {selectedDocuments.length > 0 && (
            <p style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.textSecondary,
              marginBottom: theme.spacing.md,
              fontStyle: 'italic',
            }}>
              Selected documents will be saved to your profile when you click "Save Progress" or "Next".
            </p>
          )}

          {renderDocumentGroup('Incorporation Certificate', companyData.incorporation_certificates || companyData.documents?.incorporation_cert, 'incorporation_cert')}
          {renderDocumentGroup('Accounts (Last 3 Years)', companyData.accounts_documents || companyData.documents?.accounts, 'accounts')}
          {renderDocumentGroup('Charges', companyData.charges_documents || companyData.documents?.charges, 'charges')}
          {renderDocumentGroup('Confirmation Statements', companyData.confirmation_statements || companyData.documents?.confirmation_statements, 'confirmation_statements')}
        </div>
      )}

    </div>
  );
}

export default CompanyDetails;
