import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Textarea from '../components/Textarea';
import Input from '../components/Input';
import Badge from '../components/Badge';

function Messages() {
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get('application_id');
  
  const [messages, setMessages] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(applicationId || '');
  const [newMessage, setNewMessage] = useState({ subject: '', body: '', recipient: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadApplications();
    if (applicationId) {
      setSelectedApplication(applicationId);
      loadMessages(applicationId);
    } else {
      setLoading(false);
    }
  }, [applicationId]);

  async function loadApplications() {
    try {
      const res = await api.get('/api/applications/');
      setApplications(res.data || []);
    } catch (err) {
      console.error('Messages loadApplications error:', err);
    }
  }

  async function loadMessages(appId) {
    if (!appId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/messaging/messages/by_application/?application_id=${appId}`);
      // Reverse to show newest at bottom (WhatsApp style)
      const messagesList = res.data || [];
      setMessages([...messagesList].reverse());
      // Scroll to bottom after messages load
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Messages loadMessages error:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  const handleSelectApplication = (e) => {
    const appId = e.target.value;
    setSelectedApplication(appId);
    if (appId) {
      loadMessages(appId);
      // Find the application to get recipient info
      const app = applications.find(a => a.id.toString() === appId);
      if (app) {
        // Determine recipient based on user role
        const userRole = localStorage.getItem('role');
        let recipientId = '';
        if (userRole === 'Borrower') {
          recipientId = app.lender_details?.user?.id || app.lender_details?.user || '';
        } else if (userRole === 'Lender') {
          recipientId = app.borrower_details?.user?.id || app.borrower_details?.user || '';
        }
        // Auto-populate subject with project reference if available
        const projectRef = app.project_details?.project_reference || '';
        const defaultSubject = projectRef 
          ? `Re: Project ${projectRef}`
          : `Re: ${app.project_details?.address || 'Project'}`;
        setNewMessage({ 
          ...newMessage, 
          recipient: recipientId,
          subject: newMessage.subject || defaultSubject,
        });
      }
    } else {
      setMessages([]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedApplication || (!newMessage.body.trim() && selectedFiles.length === 0)) {
      setError('Please enter a message or attach a file');
      return;
    }

    setSending(true);
    setUploading(selectedFiles.length > 0);
    setError(null);
    try {
      const app = applications.find(a => a.id.toString() === selectedApplication);
      if (!app) {
        throw new Error('Application not found');
      }

      // First, upload files if any
      let uploadedDocuments = [];
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });
        formData.append('description', `Uploaded via messaging: ${newMessage.body || 'No message'}`);

        const uploadRes = await api.post(`/api/applications/${selectedApplication}/documents/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedDocuments = uploadRes.data.documents || [];
      }

      // Then send the message
      const messageData = {
        application: selectedApplication,
        recipient: newMessage.recipient,
        subject: newMessage.subject || `Re: ${app.project_details?.address || 'Project'}`,
        body: newMessage.body || (selectedFiles.length > 0 ? `Uploaded ${selectedFiles.length} file(s)` : ''),
      };

      const messageRes = await api.post('/api/messaging/messages/', messageData);
      
      // Link uploaded documents to the message if any
      if (uploadedDocuments.length > 0 && messageRes.data.id) {
        for (const doc of uploadedDocuments) {
          try {
            await api.post('/api/messaging/attachments/', {
              message: messageRes.data.id,
              document: doc.document_id,
            });
          } catch (attachErr) {
            console.warn('Failed to link document to message:', attachErr);
          }
        }
      }

      setNewMessage({ subject: '', body: '', recipient: '' });
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadMessages(selectedApplication);
    } catch (err) {
      console.error('Messages handleSendMessage error:', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const getOtherPartyName = (message) => {
    const currentUserId = parseInt(localStorage.getItem('user_id') || '0');
    if (message.sender === currentUserId) {
      return message.recipient_username || 'Recipient';
    }
    return message.sender_username || 'Sender';
  };

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.bold,
          margin: `0 0 ${theme.spacing.sm} 0`,
          color: theme.colors.textPrimary,
        }}>
          Messages
        </h1>
        <p style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.base,
          margin: 0,
        }}>
          Communicate with borrowers and lenders about applications
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: theme.spacing.xl }}>
        {/* Application Selection */}
        <div style={commonStyles.card}>
          <h2 style={{
            fontSize: theme.typography.fontSize.xl,
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.md} 0`,
          }}>
            Select Application
          </h2>
          <select
            value={selectedApplication}
            onChange={handleSelectApplication}
            style={{
              width: '100%',
              padding: theme.spacing.sm,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.gray300}`,
              fontSize: theme.typography.fontSize.base,
            }}
          >
            <option value="">-- Select an application --</option>
            {applications.map((app) => {
              const projectRef = app.project_details?.project_reference || '';
              const address = app.project_details?.address || `Project #${app.project}`;
              const otherParty = app.lender_details?.organisation_name || app.borrower_details?.company_name || 'N/A';
              return (
                <option key={app.id} value={app.id}>
                  {projectRef ? `[${projectRef}] ` : ''}{address} - {otherParty}
                </option>
              );
            })}
          </select>
        </div>

        {/* Messages */}
        <div style={commonStyles.card}>
          {!selectedApplication ? (
            <div style={{ textAlign: 'center', padding: theme.spacing['2xl'] }}>
              <p style={{ color: theme.colors.textSecondary }}>
                Select an application to view messages
              </p>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: theme.spacing['2xl'] }}>
              <p style={{ color: theme.colors.textSecondary }}>Loading messages...</p>
            </div>
          ) : (
            <>
              <div style={{
                maxHeight: '500px',
                overflowY: 'auto',
                marginBottom: theme.spacing.lg,
                padding: theme.spacing.md,
                background: theme.colors.gray50,
                borderRadius: theme.borderRadius.md,
                display: 'flex',
                flexDirection: 'column',
              }}>
                {messages.length === 0 ? (
                  <p style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
                    No messages yet. Start the conversation below.
                  </p>
                ) : (
                  <>
                    {messages.map((message) => {
                      const isSent = message.sender_username === localStorage.getItem('username');
                      return (
                        <div
                          key={message.id}
                          style={{
                            marginBottom: theme.spacing.sm,
                            padding: theme.spacing.sm,
                            background: isSent ? theme.colors.primary : theme.colors.white,
                            color: isSent ? theme.colors.white : theme.colors.textPrimary,
                            borderRadius: theme.borderRadius.md,
                            maxWidth: '75%',
                            alignSelf: isSent ? 'flex-end' : 'flex-start',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          }}
                        >
                          <div style={{
                            fontSize: theme.typography.fontSize.xs,
                            opacity: 0.8,
                            marginBottom: theme.spacing.xs,
                          }}>
                            {new Date(message.created_at).toLocaleTimeString()}
                          </div>
                          <div style={{ marginBottom: theme.spacing.xs }}>
                            {message.body}
                          </div>
                          {message.attachments && message.attachments.length > 0 && (
                            <div style={{ marginTop: theme.spacing.xs }}>
                              {message.attachments.map((att, idx) => (
                                <div key={idx} style={{
                                  fontSize: theme.typography.fontSize.xs,
                                  opacity: 0.9,
                                  marginTop: theme.spacing.xs,
                                }}>
                                  📎 {att.document?.file_name || 'Attachment'}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Send Message Form */}
              <form onSubmit={handleSendMessage}>
                <Input
                  label="Subject"
                  value={newMessage.subject}
                  onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                  placeholder="Message subject (optional)"
                />
                <Textarea
                  label="Message"
                  value={newMessage.body}
                  onChange={(e) => setNewMessage({ ...newMessage, body: e.target.value })}
                  placeholder="Type your message here..."
                  rows={3}
                />
                
                {/* File Upload */}
                <div style={{ marginBottom: theme.spacing.md }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📎 Attach Files
                    </Button>
                    {selectedFiles.length > 0 && (
                      <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                        {selectedFiles.length} file(s) selected
                      </span>
                    )}
                  </div>
                  {selectedFiles.length > 0 && (
                    <div style={{ marginTop: theme.spacing.sm }}>
                      {selectedFiles.map((file, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: theme.spacing.xs,
                          background: theme.colors.gray100,
                          borderRadius: theme.borderRadius.sm,
                          marginBottom: theme.spacing.xs,
                        }}>
                          <span style={{ fontSize: theme.typography.fontSize.sm }}>
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveFile(index)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={sending || uploading || (!newMessage.body.trim() && selectedFiles.length === 0)}
                  variant="primary"
                >
                  {uploading ? 'Uploading...' : sending ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Messages;
