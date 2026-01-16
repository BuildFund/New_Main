import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from './Button';
import Input from './Input';
import Badge from './Badge';

function OnboardingForm({ onComplete, onClose }) {
  const [sections, setSections] = useState([]);
  const [requiredDocuments, setRequiredDocuments] = useState([]);
  const [formData, setFormData] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadFormStructure();
  }, []);

  async function loadFormStructure() {
    try {
      const res = await api.get('/api/onboarding/form_structure/');
      setSections(res.data.sections || []);
      setRequiredDocuments(res.data.required_documents || []);
      
      // Initialize form data with existing values
      const initialData = {};
      res.data.sections.forEach(section => {
        section.fields.forEach(field => {
          if (field.value) {
            initialData[field.field] = field.value;
          }
        });
      });
      setFormData(initialData);
    } catch (err) {
      // Failed to load form structure
      setError('Failed to load form. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(field, value) {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }

  function validateField(field, value, required, type) {
    if (required && (!value || value.toString().trim() === '')) {
      return 'This field is required';
    }
    if (type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Please enter a valid email address';
    }
    if (type === 'number' && value && isNaN(parseFloat(value))) {
      return 'Please enter a valid number';
    }
    return null;
  }

  function validateSection(sectionIndex) {
    const section = sections[sectionIndex];
    const newErrors = {};
    
    section.fields.forEach(field => {
      const value = formData[field.field];
      const error = validateField(field.field, value, field.required, field.type);
      if (error) {
        newErrors[field.field] = error;
      }
    });
    
    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Save data via save_data endpoint
      await api.post('/api/onboarding/save_data/', formData);
      
      // Also update the session's collected_data
      try {
        const sessionRes = await api.get('/api/onboarding/chat/');
        const sessionId = sessionRes.data.session_id;
        
        // Update session with collected data
        await api.post('/api/onboarding/chat/', {
          message: 'save_form_data',
          step: 'save',
          session_id: sessionId,
          form_data: formData,
        });
        } catch (sessionErr) {
          // Session update is optional, continue even if it fails
        }
      
      alert('Progress saved successfully!');
    } catch (err) {
      alert('Failed to save progress. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function getStepForField(field) {
    // Find the step for a given field
    for (const section of sections) {
      for (const fieldData of section.fields) {
        if (fieldData.field === field) {
          return fieldData.step;
        }
      }
    }
    return null;
  }

  async function handleFileUpload(files, documentType = null) {
    if (!files || files.length === 0) return;

    const formDataObj = new FormData();
    Array.from(files).forEach(file => {
      formDataObj.append('files', file);
    });
    if (documentType) {
      formDataObj.append('document_type', documentType);
    }

    try {
      const res = await api.post('/api/onboarding/upload_documents/', formDataObj, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const uploaded = res.data.documents || [];
      setUploadedFiles(prev => ({
        ...prev,
        [documentType || 'general']: [...(prev[documentType || 'general'] || []), ...uploaded],
      }));
      
      return uploaded;
    } catch (err) {
      throw err;
    }
  }

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    // Validate all sections
    let isValid = true;
    for (let i = 0; i < sections.length; i++) {
      if (!validateSection(i)) {
        isValid = false;
        // Jump to first section with errors
        setActiveSection(i);
        break;
      }
    }
    
    if (!isValid) {
      alert('Please fix the errors before submitting.');
      return;
    }
    
    setSubmitting(true);
    try {
      // Save all form data first
      await api.post('/api/onboarding/save_data/', formData);
      
      // Get or create session and submit completion
      const sessionRes = await api.get('/api/onboarding/chat/');
      const sessionId = sessionRes.data.session_id;
      
      // Submit all form data to the session
      for (const [field, value] of Object.entries(formData)) {
        if (value) {
          const step = getStepForField(field);
          if (step) {
            await api.post('/api/onboarding/chat/', {
              message: value.toString(),
              step: step,
              session_id: sessionId,
            });
          }
        }
      }
      
      // Mark as complete
      await api.post('/api/onboarding/chat/', {
        message: 'complete',
        step: 'review',
        session_id: sessionId,
      });
      
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderField(field) {
    const value = formData[field.field] || '';
    const error = errors[field.field];

    switch (field.type) {
      case 'select':
        return (
          <div key={field.field} style={commonStyles.formGroup}>
            <label style={commonStyles.label}>
              {field.label}
              {field.required && <span style={{ color: theme.colors.error }}> *</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleInputChange(field.field, e.target.value)}
              style={{
                ...commonStyles.input,
                borderColor: error ? theme.colors.error : theme.colors.gray300,
              }}
              required={field.required}
            >
              <option value="">Select an option...</option>
              {field.options.map((option, idx) => (
                <option key={idx} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {error && (
              <div style={{ color: theme.colors.error, fontSize: theme.typography.fontSize.sm, marginTop: theme.spacing.xs }}>
                {error}
              </div>
            )}
          </div>
        );
      
      case 'date':
        return (
          <Input
            key={field.field}
            label={field.label}
            type="date"
            value={value}
            onChange={(e) => handleInputChange(field.field, e.target.value)}
            error={error}
            required={field.required}
          />
        );
      
      case 'number':
        return (
          <Input
            key={field.field}
            label={field.label}
            type="number"
            value={value}
            onChange={(e) => handleInputChange(field.field, e.target.value)}
            error={error}
            required={field.required}
          />
        );
      
      case 'email':
        return (
          <Input
            key={field.field}
            label={field.label}
            type="email"
            value={value}
            onChange={(e) => handleInputChange(field.field, e.target.value)}
            error={error}
            required={field.required}
          />
        );
      
      case 'phone':
        return (
          <Input
            key={field.field}
            label={field.label}
            type="tel"
            value={value}
            onChange={(e) => handleInputChange(field.field, e.target.value)}
            error={error}
            required={field.required}
            placeholder="+44 123 456 7890"
          />
        );
      
      case 'textarea':
        return (
          <div key={field.field} style={commonStyles.formGroup}>
            <label style={commonStyles.label}>
              {field.label}
              {field.required && <span style={{ color: theme.colors.error }}> *</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => handleInputChange(field.field, e.target.value)}
              style={{
                ...commonStyles.input,
                minHeight: '100px',
                resize: 'vertical',
                borderColor: error ? theme.colors.error : theme.colors.gray300,
              }}
              required={field.required}
            />
            {error && (
              <div style={{ color: theme.colors.error, fontSize: theme.typography.fontSize.sm, marginTop: theme.spacing.xs }}>
                {error}
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <Input
            key={field.field}
            label={field.label}
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.field, e.target.value)}
            error={error}
            required={field.required}
          />
        );
    }
  }

  if (loading) {
    return (
      <div style={{ ...commonStyles.container, textAlign: 'center', padding: theme.spacing['3xl'] }}>
        <p style={{ color: theme.colors.textSecondary }}>Loading form...</p>
      </div>
    );
  }

  return (
    <div style={{
      ...commonStyles.container,
      maxWidth: '1000px',
      margin: '0 auto',
      padding: theme.spacing.xl,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
      }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.textPrimary,
          margin: 0,
        }}>
          Complete Your Profile
        </h1>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: theme.spacing['2xl'] }}>
          <p style={{ color: theme.colors.textSecondary }}>Loading form...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
        {/* Section Navigation */}
        <div style={{
          display: 'flex',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.xl,
          flexWrap: 'wrap',
          borderBottom: `2px solid ${theme.colors.gray200}`,
          paddingBottom: theme.spacing.md,
        }}>
          {sections.map((section, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveSection(idx)}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                border: 'none',
                background: activeSection === idx ? theme.colors.primary : 'transparent',
                color: activeSection === idx ? theme.colors.white : theme.colors.textPrimary,
                borderRadius: theme.borderRadius.md,
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: activeSection === idx ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.normal,
                transition: 'all 0.2s ease',
              }}
            >
              {section.name}
            </button>
          ))}
        </div>

        {/* Active Section */}
        {sections[activeSection] && (
          <div style={{
            ...commonStyles.card,
            padding: theme.spacing.xl,
            marginBottom: theme.spacing.xl,
          }}>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.lg} 0`,
              color: theme.colors.textPrimary,
            }}>
              {sections[activeSection].name}
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: theme.spacing.lg,
            }}>
              {sections[activeSection].fields.map(field => renderField(field))}
            </div>
          </div>
        )}

        {/* Documents Section */}
        {requiredDocuments.length > 0 && (
          <div style={{
            ...commonStyles.card,
            padding: theme.spacing.xl,
            marginBottom: theme.spacing.xl,
          }}>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.lg} 0`,
              color: theme.colors.textPrimary,
            }}>
              Required Documents
            </h2>

            {requiredDocuments.map((doc, idx) => (
              <div key={idx} style={{ marginBottom: theme.spacing.lg }}>
                <h3 style={{
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.medium,
                  margin: `0 0 ${theme.spacing.sm} 0`,
                }}>
                  {doc.name}
                </h3>
                <p style={{
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.fontSize.sm,
                  margin: `0 0 ${theme.spacing.md} 0`,
                }}>
                  {doc.description}
                </p>
                
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  style={{
                    padding: theme.spacing.lg,
                    border: `2px dashed ${dragActive ? theme.colors.primary : theme.colors.gray300}`,
                    borderRadius: theme.borderRadius.md,
                    textAlign: 'center',
                    background: dragActive ? theme.colors.primaryLight : theme.colors.gray50,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e.target.files, doc.name)}
                  />
                  <div style={{ fontSize: '24px', marginBottom: theme.spacing.sm }}>📎</div>
                  <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                    Drag and drop files here or click to browse
                  </div>
                </div>

                {uploadedFiles[doc.name] && uploadedFiles[doc.name].length > 0 && (
                  <div style={{ marginTop: theme.spacing.sm }}>
                    {uploadedFiles[doc.name].map((file, fileIdx) => (
                      <Badge key={fileIdx} variant="success" style={{ marginRight: theme.spacing.xs }}>
                        {file.name || 'Uploaded'}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: theme.spacing.md,
          justifyContent: 'flex-end',
          marginTop: theme.spacing.xl,
        }}>
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={saving || submitting}
            loading={saving}
          >
            Save Progress
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (activeSection > 0) {
                setActiveSection(activeSection - 1);
              }
            }}
            disabled={activeSection === 0}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (validateSection(activeSection) && activeSection < sections.length - 1) {
                setActiveSection(activeSection + 1);
              }
            }}
            disabled={activeSection === sections.length - 1}
          >
            Next
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || submitting}
            loading={submitting}
          >
            Submit & Complete
          </Button>
        </div>
      </form>
      )}
    </div>
  );
}

export default OnboardingForm;
