import React, { useEffect, useState } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';

function Documents() {
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/documents/');
      // Handle both array and paginated responses
      const docs = res.data?.results || res.data || [];
      setDocuments(docs);
    } catch (err) {
      console.error('Documents loadDocuments error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
      });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load documents';
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          errorMessage = 'Authentication failed. Please log in again.';
          // Clear invalid token and redirect
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          window.location.href = '/login';
          return;
        }
        errorMessage = err.response.data?.detail || 
                      err.response.data?.error || 
                      `Server error: ${err.response.status}`;
      } else if (err.request) {
        errorMessage = 'Network Error: Cannot connect to backend server. Please ensure the Django server is running on http://localhost:8000';
      } else {
        errorMessage = err.message || 'Unknown error';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (loading) {
    return (
      <div style={commonStyles.container}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading documents...</p>
      </div>
    );
  }

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.bold,
          margin: `0 0 ${theme.spacing.sm} 0`,
          color: theme.colors.textPrimary,
        }}>
          My Documents
        </h1>
        <p style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.base,
          margin: 0,
        }}>
          Manage your uploaded documents
        </p>
      </div>

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

      <div style={{
        ...commonStyles.card,
        marginBottom: theme.spacing.xl,
        background: theme.colors.infoLight,
        borderColor: theme.colors.info,
      }}>
        <h3 style={{
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.semibold,
          margin: `0 0 ${theme.spacing.sm} 0`,
          color: theme.colors.infoDark,
        }}>
          Upload Documents
        </h3>
        <p style={{
          color: theme.colors.infoDark,
          fontSize: theme.typography.fontSize.sm,
          margin: 0,
        }}>
          File upload functionality requires backend file handling. Currently, documents can be uploaded via the Django admin panel or through API endpoints.
        </p>
      </div>

      {documents.length === 0 ? (
        <div style={{
          ...commonStyles.card,
          textAlign: 'center',
          padding: theme.spacing['3xl'],
        }}>
          <p style={{ 
            color: theme.colors.textSecondary, 
            fontSize: theme.typography.fontSize.lg,
            margin: 0,
          }}>
            No documents uploaded yet.
          </p>
        </div>
      ) : (
        <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={commonStyles.table}>
              <thead style={commonStyles.tableHeader}>
                <tr>
                  <th style={commonStyles.tableCell}>File Name</th>
                  <th style={commonStyles.tableCell}>Type</th>
                  <th style={commonStyles.tableCell}>Size</th>
                  <th style={commonStyles.tableCell}>Description</th>
                  <th style={commonStyles.tableCell}>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: `1px solid ${theme.colors.gray200}` }}>
                    <td style={{ ...commonStyles.tableCell, fontWeight: theme.typography.fontWeight.medium }}>
                      {doc.file_name}
                    </td>
                    <td style={commonStyles.tableCell}>{doc.file_type}</td>
                    <td style={commonStyles.tableCell}>{formatFileSize(doc.file_size)}</td>
                    <td style={commonStyles.tableCell}>{doc.description || '—'}</td>
                    <td style={{ ...commonStyles.tableCell, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Documents;
