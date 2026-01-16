import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Layout from '../components/Layout';
import Select from '../components/Select';
import Textarea from '../components/Textarea';

function AdminBorrowerReview() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [changeRequests, setChangeRequests] = useState([]);
  const [internalNotes, setInternalNotes] = useState('');
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    loadProfiles();
  }, [statusFilter]);

  async function loadProfiles() {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter 
        ? `/api/borrowers/admin/reviews/?status=${statusFilter}`
        : '/api/borrowers/admin/reviews/';
      const res = await api.get(url);
      setProfiles(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load borrower profiles');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(profileId) {
    if (!window.confirm('Are you sure you want to approve this borrower profile?')) {
      return;
    }
    
    setError(null);
    try {
      await api.post(`/api/borrowers/admin/reviews/${profileId}/approve/`);
      setSuccessMessage('Borrower profile approved successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        loadProfiles();
        setSelectedProfile(null);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve profile');
    }
  }

  async function handleRequestChanges(profileId) {
    if (changeRequests.length === 0) {
      setError('Please add at least one change request');
      return;
    }
    
    setError(null);
    try {
      await api.post(`/api/borrowers/admin/reviews/${profileId}/request_changes/`, {
        change_requests: changeRequests,
        internal_notes: internalNotes,
      });
      setSuccessMessage('Change requests sent to borrower');
      setTimeout(() => {
        setSuccessMessage(null);
        loadProfiles();
        setSelectedProfile(null);
        setChangeRequests([]);
        setInternalNotes('');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request changes');
    }
  }

  async function handleAddNote(profileId) {
    if (!newNote.trim()) {
      setError('Note cannot be empty');
      return;
    }
    
    setError(null);
    try {
      await api.post(`/api/borrowers/admin/reviews/${profileId}/add_note/`, {
        note: newNote,
      });
      setSuccessMessage('Note added successfully');
      setNewNote('');
      setTimeout(() => {
        setSuccessMessage(null);
        loadProfiles();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add note');
    }
  }

  function getStatusBadge(status) {
    const statusColors = {
      'draft': 'secondary',
      'ready_for_review': 'warning',
      'under_review': 'info',
      'changes_requested': 'warning',
      'approved': 'success',
    };
    return <Badge variant={statusColors[status] || 'secondary'}>{status.replace('_', ' ').toUpperCase()}</Badge>;
  }

  if (loading) {
    return (
      <Layout role="Admin">
        <div style={commonStyles.container}>
          <p>Loading borrower profiles...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="Admin">
      <div style={commonStyles.container}>
        <div style={{ marginBottom: theme.spacing.xl }}>
          <h1 style={{ marginBottom: theme.spacing.md }}>Borrower Profile Review</h1>
          <p style={{ color: theme.colors.textSecondary }}>
            Review and approve borrower profiles before they can create projects.
          </p>
        </div>

        {successMessage && (
          <div style={{
            background: theme.colors.successLight,
            color: theme.colors.successDark,
            padding: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.lg,
          }}>
            {successMessage}
          </div>
        )}

        {error && (
          <div style={{
            background: theme.colors.errorLight,
            color: theme.colors.errorDark,
            padding: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.lg,
          }}>
            {error}
          </div>
        )}

        {/* Filter */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <Select
            label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: '300px' }}
          >
            <option value="">All Statuses</option>
            <option value="ready_for_review">Ready for Review</option>
            <option value="under_review">Under Review</option>
            <option value="changes_requested">Changes Requested</option>
            <option value="approved">Approved</option>
          </Select>
        </div>

        {/* Profiles List */}
        <div style={{ display: 'grid', gap: theme.spacing.md, marginBottom: theme.spacing.xl }}>
          {profiles.length === 0 ? (
            <p style={{ color: theme.colors.textSecondary }}>No borrower profiles found.</p>
          ) : (
            profiles.map((profile) => (
              <div
                key={profile.id}
                style={{
                  ...commonStyles.card,
                  padding: theme.spacing.lg,
                  cursor: 'pointer',
                  border: selectedProfile?.id === profile.id ? `2px solid ${theme.colors.primary}` : `1px solid ${theme.colors.gray300}`,
                }}
                onClick={() => setSelectedProfile(profile)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: `0 0 ${theme.spacing.xs} 0` }}>
                      {profile.user_email || profile.user || 'Unknown User'}
                    </h3>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      Company: {profile.company_name || 'N/A'} | 
                      Progress: {profile.get_wizard_progress ? profile.get_wizard_progress() : 'N/A'}%
                    </p>
                  </div>
                  <div>
                    {getStatusBadge(profile.wizard_status)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Profile Details Panel */}
        {selectedProfile && (
          <div style={{
            ...commonStyles.card,
            padding: theme.spacing.xl,
            marginTop: theme.spacing.xl,
          }}>
            <h2 style={{ marginBottom: theme.spacing.lg }}>Profile Details</h2>
            
            <div style={{ marginBottom: theme.spacing.lg }}>
              <p><strong>Status:</strong> {getStatusBadge(selectedProfile.wizard_status)}</p>
              <p><strong>Company:</strong> {selectedProfile.company_name || 'N/A'}</p>
              <p><strong>Progress:</strong> {selectedProfile.get_wizard_progress ? selectedProfile.get_wizard_progress() : 'N/A'}%</p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
              {selectedProfile.wizard_status === 'ready_for_review' && (
                <>
                  <Button
                    variant="success"
                    onClick={() => handleApprove(selectedProfile.id)}
                  >
                    Approve Profile
                  </Button>
                  
                  <div style={{
                    padding: theme.spacing.md,
                    border: `1px solid ${theme.colors.gray300}`,
                    borderRadius: theme.borderRadius.md,
                  }}>
                    <h3 style={{ marginBottom: theme.spacing.sm }}>Request Changes</h3>
                    <Textarea
                      label="Change Requests (one per line)"
                      value={changeRequests.join('\n')}
                      onChange={(e) => setChangeRequests(e.target.value.split('\n').filter(l => l.trim()))}
                      placeholder="Enter change requests, one per line"
                      style={{ marginBottom: theme.spacing.sm }}
                    />
                    <Textarea
                      label="Internal Notes (not visible to borrower)"
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Internal notes for admin reference"
                      style={{ marginBottom: theme.spacing.sm }}
                    />
                    <Button
                      variant="warning"
                      onClick={() => handleRequestChanges(selectedProfile.id)}
                    >
                      Request Changes
                    </Button>
                  </div>
                </>
              )}

              {/* Add Note */}
              <div style={{
                padding: theme.spacing.md,
                border: `1px solid ${theme.colors.gray300}`,
                borderRadius: theme.borderRadius.md,
              }}>
                <h3 style={{ marginBottom: theme.spacing.sm }}>Add Internal Note</h3>
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add an internal note (not visible to borrower)"
                  style={{ marginBottom: theme.spacing.sm }}
                />
                <Button
                  variant="outline"
                  onClick={() => handleAddNote(selectedProfile.id)}
                >
                  Add Note
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default AdminBorrowerReview;
