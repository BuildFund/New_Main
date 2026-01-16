import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Textarea from '../components/Textarea';
import Badge from '../components/Badge';

function ConsultantAppointmentDetail() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [progressNote, setProgressNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  async function loadAppointment() {
    try {
      const res = await api.get(`/api/consultants/appointments/${appointmentId}/`);
      setAppointment(res.data);
      
      // Load documents if available
      if (res.data.documents && res.data.documents.length > 0) {
        setDocuments(res.data.documents);
      }
    } catch (err) {
      setError('Failed to load appointment details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      await api.post(`/api/consultants/appointments/${appointmentId}/upload-documents/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Reload appointment to get updated documents
      await loadAppointment();
    } catch (err) {
      console.error('Document upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  const handleAddProgressNote = async () => {
    if (!progressNote.trim()) return;

    setAddingNote(true);
    setError(null);

    try {
      const currentNotes = appointment.progress_notes || [];
      const newNote = {
        timestamp: new Date().toISOString(),
        note: progressNote,
      };

      await api.patch(`/api/consultants/appointments/${appointmentId}/`, {
        progress_notes: [...currentNotes, newNote],
      });

      setProgressNote('');
      await loadAppointment();
    } catch (err) {
      console.error('Add note error:', err);
      setError(err.response?.data?.error || 'Failed to add progress note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      await api.patch(`/api/consultants/appointments/${appointmentId}/`, {
        status: newStatus,
      });
      await loadAppointment();
    } catch (err) {
      console.error('Status update error:', err);
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      appointed: theme.colors.primary,
      in_progress: theme.colors.info,
      completed: theme.colors.success,
      cancelled: theme.colors.error,
    };
    return colors[status] || theme.colors.gray500;
  };

  if (loading) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
        <p>Loading appointment details...</p>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div style={{ padding: theme.spacing.xl }}>
        <div style={commonStyles.card}>
          <h2>Appointment Not Found</h2>
          <p>The appointment you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/consultant/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: theme.spacing.xl }}>
      <div style={{ marginBottom: theme.spacing.xl }}>
        <Button
          variant="outline"
          onClick={() => navigate('/consultant/dashboard')}
          style={{ marginBottom: theme.spacing.md }}
        >
          ← Back to Dashboard
        </Button>
        <h1 style={{ ...theme.typography.h1, marginBottom: theme.spacing.sm }}>
          Appointment Details
        </h1>
        <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
          <Badge color={getStatusColor(appointment.status)}>
            {appointment.status.replace('_', ' ')}
          </Badge>
          <p style={{ color: theme.colors.textSecondary, margin: 0 }}>
            Service: {appointment.service_type_display || appointment.service_type} - Application #{appointment.application_id}
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          ...commonStyles.card,
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          marginBottom: theme.spacing.lg,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: theme.spacing.lg }}>
        {/* Appointment Information */}
        <div style={commonStyles.card}>
          <h2 style={{ marginBottom: theme.spacing.md }}>Appointment Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
            <div>
              <strong>Quote Amount:</strong> £{parseFloat(appointment.quote_amount || 0).toLocaleString()}
            </div>
            {appointment.start_date && (
              <div>
                <strong>Start Date:</strong> {new Date(appointment.start_date).toLocaleDateString()}
              </div>
            )}
            {appointment.expected_completion_date && (
              <div>
                <strong>Expected Completion:</strong> {new Date(appointment.expected_completion_date).toLocaleDateString()}
              </div>
            )}
            {appointment.actual_completion_date && (
              <div>
                <strong>Actual Completion:</strong> {new Date(appointment.actual_completion_date).toLocaleDateString()}
              </div>
            )}
          </div>

          {appointment.status === 'appointed' && (
            <div style={{ marginTop: theme.spacing.md }}>
              <Button
                variant="primary"
                onClick={() => handleStatusUpdate('in_progress')}
              >
                Mark as In Progress
              </Button>
            </div>
          )}

          {appointment.status === 'in_progress' && (
            <div style={{ marginTop: theme.spacing.md }}>
              <Button
                variant="success"
                onClick={() => handleStatusUpdate('completed')}
              >
                Mark as Completed
              </Button>
            </div>
          )}
        </div>

        {/* Documents */}
        <div style={commonStyles.card}>
          <h2 style={{ marginBottom: theme.spacing.md }}>Documents</h2>
          
          <div style={{ marginBottom: theme.spacing.md }}>
            <label style={{ display: 'block', marginBottom: theme.spacing.sm }}>
              Upload Documents
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ width: '100%' }}
            />
            {uploading && <p style={{ color: theme.colors.textSecondary }}>Uploading...</p>}
          </div>

          {documents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
              {documents.map((doc, idx) => (
                <div key={idx} style={{
                  padding: theme.spacing.sm,
                  background: theme.colors.gray50,
                  borderRadius: theme.borderRadius.sm,
                }}>
                  <a
                    href={doc.file_url || doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: theme.colors.primary, textDecoration: 'none' }}
                  >
                    {doc.name || doc.filename || `Document ${idx + 1}`}
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: theme.colors.textSecondary }}>No documents uploaded yet.</p>
          )}
        </div>
      </div>

      {/* Progress Notes */}
      <div style={{ ...commonStyles.card, marginTop: theme.spacing.lg }}>
        <h2 style={{ marginBottom: theme.spacing.md }}>Progress Notes</h2>
        
        <div style={{ marginBottom: theme.spacing.md }}>
          <Textarea
            label="Add Progress Note"
            value={progressNote}
            onChange={(e) => setProgressNote(e.target.value)}
            rows={3}
            placeholder="Add a note about the progress of this appointment..."
            style={{ marginBottom: theme.spacing.sm }}
          />
          <Button
            variant="primary"
            onClick={handleAddProgressNote}
            disabled={addingNote || !progressNote.trim()}
          >
            {addingNote ? 'Adding...' : 'Add Note'}
          </Button>
        </div>

        {appointment.progress_notes && appointment.progress_notes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
            {appointment.progress_notes.map((note, idx) => (
              <div key={idx} style={{
                padding: theme.spacing.md,
                background: theme.colors.gray50,
                borderRadius: theme.borderRadius.md,
                borderLeft: `4px solid ${theme.colors.primary}`,
              }}>
                <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>
                  {new Date(note.timestamp).toLocaleString()}
                </div>
                <div>{note.note}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: theme.colors.textSecondary }}>No progress notes yet.</p>
        )}
      </div>
    </div>
  );
}

export default ConsultantAppointmentDetail;
