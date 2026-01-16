import React, { useEffect, useState } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Input from '../components/Input';
import Button from '../components/Button';
import Badge from '../components/Badge';

function AccountSettings() {
  const [activeTab, setActiveTab] = useState('personal');
  const [user, setUser] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  
  const role = localStorage.getItem('role');
  const isLender = role === 'Lender';
  const isBorrower = role === 'Borrower';
  const isAdmin = role === 'Admin';

  // Form states
  const [personalInfo, setPersonalInfo] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [newTeamMember, setNewTeamMember] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
  });

  useEffect(() => {
    loadUserData();
    if (isLender) {
      loadTeamMembers();
    }
  }, []);

  async function loadUserData() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/accounts/account/me/');
      setUser(res.data);
      setPersonalInfo({
        username: res.data.username || '',
        email: res.data.email || '',
        first_name: res.data.first_name || '',
        last_name: res.data.last_name || '',
      });
    } catch (err) {
      console.error('Failed to load user data:', err);
      setError('Failed to load account information');
    } finally {
      setLoading(false);
    }
  }

  async function loadTeamMembers() {
    try {
      const res = await api.get('/api/accounts/account/team_members/');
      setTeamMembers(res.data || []);
    } catch (err) {
      console.error('Failed to load team members:', err);
    }
  }

  async function handleUpdatePersonalInfo(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await api.put('/api/accounts/account/me/', personalInfo);
      setMessage('Personal information updated successfully');
      await loadUserData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update personal information');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('New passwords do not match');
      setSaving(false);
      return;
    }

    try {
      await api.post('/api/accounts/account/change_password/', passwordForm);
      setMessage('Password changed successfully');
      setPasswordForm({
        old_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTeamMember(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await api.post('/api/accounts/account/team_members/', newTeamMember);
      setMessage('Team member added successfully');
      setNewTeamMember({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
      });
      await loadTeamMembers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add team member');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivateTeamMember(userId) {
    if (!window.confirm('Are you sure you want to deactivate this team member?')) {
      return;
    }

    try {
      await api.delete(`/api/accounts/account/${userId}/team_member/`);
      setMessage('Team member deactivated successfully');
      await loadTeamMembers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deactivate team member');
    }
  }

  const tabs = [
    { id: 'personal', label: 'Personal Information', icon: '👤' },
    { id: 'security', label: 'Security', icon: '🔒' },
  ];

  if (isLender) {
    tabs.push({ id: 'team', label: 'Team Members', icon: '👥' });
  }

  if (loading) {
    return (
      <div style={commonStyles.container}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading...</p>
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
          Account Settings
        </h1>
        <p style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.base,
          margin: 0,
        }}>
          Manage your account information, security, and team members
        </p>
      </div>

      {/* Messages */}
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

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.xl,
        borderBottom: `2px solid ${theme.colors.gray200}`,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setMessage(null);
              setError(null);
            }}
            style={{
              padding: `${theme.spacing.md} ${theme.spacing.lg}`,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id 
                ? `3px solid ${theme.colors.primary}` 
                : '3px solid transparent',
              color: activeTab === tab.id 
                ? theme.colors.primary 
                : theme.colors.textSecondary,
              fontWeight: activeTab === tab.id 
                ? theme.typography.fontWeight.semibold 
                : theme.typography.fontWeight.normal,
              cursor: 'pointer',
              fontSize: theme.typography.fontSize.base,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              transition: `all ${theme.transitions.fast}`,
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={commonStyles.card}>
        {/* Personal Information Tab */}
        {activeTab === 'personal' && (
          <div>
            <h2 style={{
              margin: `0 0 ${theme.spacing.lg} 0`,
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
            }}>
              Personal Information
            </h2>
            <form onSubmit={handleUpdatePersonalInfo}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: theme.spacing.lg,
                marginBottom: theme.spacing.lg,
              }}>
                <Input
                  label="Username"
                  value={personalInfo.username}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, username: e.target.value })}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={personalInfo.email}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                  required
                />
                <Input
                  label="First Name"
                  value={personalInfo.first_name}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, first_name: e.target.value })}
                />
                <Input
                  label="Last Name"
                  value={personalInfo.last_name}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, last_name: e.target.value })}
                />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: theme.spacing.md,
              }}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div>
            <h2 style={{
              margin: `0 0 ${theme.spacing.lg} 0`,
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
            }}>
              Change Password
            </h2>
            <p style={{
              color: theme.colors.textSecondary,
              marginBottom: theme.spacing.lg,
            }}>
              Update your password to keep your account secure. Passwords must be at least 12 characters long.
            </p>
            <form onSubmit={handleChangePassword}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: theme.spacing.lg,
                marginBottom: theme.spacing.lg,
                maxWidth: '500px',
              }}>
                <Input
                  label="Current Password"
                  type="password"
                  value={passwordForm.old_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                  required
                />
                <Input
                  label="New Password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  required
                  minLength={12}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  required
                  minLength={12}
                />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: theme.spacing.md,
              }}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving}
                >
                  {saving ? 'Changing...' : 'Change Password'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Team Members Tab (Lenders only) */}
        {activeTab === 'team' && isLender && (
          <div>
            <h2 style={{
              margin: `0 0 ${theme.spacing.lg} 0`,
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
            }}>
              Team Members
            </h2>
            <p style={{
              color: theme.colors.textSecondary,
              marginBottom: theme.spacing.lg,
            }}>
              Add and manage team members for your organization.
            </p>

            {/* Add Team Member Form */}
            <div style={{
              ...commonStyles.card,
              background: theme.colors.gray50,
              marginBottom: theme.spacing.xl,
            }}>
              <h3 style={{
                margin: `0 0 ${theme.spacing.md} 0`,
                fontSize: theme.typography.fontSize.xl,
              }}>
                Add New Team Member
              </h3>
              <form onSubmit={handleAddTeamMember}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: theme.spacing.md,
                  marginBottom: theme.spacing.md,
                }}>
                  <Input
                    label="Username"
                    value={newTeamMember.username}
                    onChange={(e) => setNewTeamMember({ ...newTeamMember, username: e.target.value })}
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={newTeamMember.email}
                    onChange={(e) => setNewTeamMember({ ...newTeamMember, email: e.target.value })}
                    required
                  />
                  <Input
                    label="First Name"
                    value={newTeamMember.first_name}
                    onChange={(e) => setNewTeamMember({ ...newTeamMember, first_name: e.target.value })}
                  />
                  <Input
                    label="Last Name"
                    value={newTeamMember.last_name}
                    onChange={(e) => setNewTeamMember({ ...newTeamMember, last_name: e.target.value })}
                  />
                  <Input
                    label="Password"
                    type="password"
                    value={newTeamMember.password}
                    onChange={(e) => setNewTeamMember({ ...newTeamMember, password: e.target.value })}
                    required
                    minLength={12}
                    style={{ gridColumn: '1 / -1' }}
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving}
                >
                  {saving ? 'Adding...' : 'Add Team Member'}
                </Button>
              </form>
            </div>

            {/* Team Members List */}
            <div>
              <h3 style={{
                margin: `0 0 ${theme.spacing.md} 0`,
                fontSize: theme.typography.fontSize.xl,
              }}>
                Current Team Members
              </h3>
              {teamMembers.length === 0 ? (
                <p style={{ color: theme.colors.textSecondary }}>
                  No team members yet. Add your first team member above.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={commonStyles.table}>
                    <thead style={commonStyles.tableHeader}>
                      <tr>
                        <th style={commonStyles.tableCell}>Name</th>
                        <th style={commonStyles.tableCell}>Email</th>
                        <th style={commonStyles.tableCell}>Username</th>
                        <th style={commonStyles.tableCell}>Status</th>
                        <th style={commonStyles.tableCell}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member) => (
                        <tr key={member.id} style={{ borderBottom: `1px solid ${theme.colors.gray200}` }}>
                          <td style={commonStyles.tableCell}>
                            {member.first_name} {member.last_name}
                          </td>
                          <td style={commonStyles.tableCell}>{member.email}</td>
                          <td style={commonStyles.tableCell}>{member.username}</td>
                          <td style={commonStyles.tableCell}>
                            {member.is_active ? (
                              <Badge variant="success">Active</Badge>
                            ) : (
                              <Badge variant="error">Inactive</Badge>
                            )}
                          </td>
                          <td style={commonStyles.tableCell}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeactivateTeamMember(member.id)}
                            >
                              Deactivate
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AccountSettings;
